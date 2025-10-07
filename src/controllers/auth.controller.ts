// src/controllers/auth.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify'
import { getCtx } from '../helpers/context.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import * as authService from '../services/auth.service'
import type { LoginBody, RegisterBody, ChangePasswordBody } from '../schemas/auth.schema'

/** 注册（是否允许由 env 控制） */
export async function register(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  if (!ctx.config?.authAllowRegistration) {
    throw new AppError(
      'Registration disabled',
      HTTP_STATUS.FORBIDDEN.statusCode,
      ERROR_TYPES.FORBIDDEN
    )
  }

  const { email, password, displayName } = req.body as RegisterBody
  await authService.createUser(ctx, email, password, displayName)
  return reply.code(201).send({ message: 'register success' })
}

/** 返回认证相关特性信息（如注册是否开放） */
export async function getAuthFeatures(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  return reply.send({
    message: 'ok',
    data: {
      allowRegistration: Boolean(ctx.config?.authAllowRegistration),
    },
  })
}

/** 登录：access 返回 JSON；refresh 通过 httpOnly Cookie 下发 */
export async function login(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { email, password } = req.body as LoginBody

  const user = await authService.findUserByEmail(ctx, email)
  if (!user) {
    throw new AppError(
      'Invalid credentials',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  }
  const ok = await authService.verifyPassword(user.passwordHash, password)
  if (!ok) {
    throw new AppError(
      'Invalid credentials',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  }

  const accessToken = await reply.accessSign({
    sub: user.id,
    role: user.role,
    type: 'access',
    ver: user.tokenVersion,
  })
  const jti = authService.genJti()
  const refreshToken = await reply.refreshSign({ sub: user.id, jti, type: 'refresh' })

  await authService.persistRefreshToken(
    ctx,
    user.id,
    refreshToken,
    jti,
    req.ip,
    req.headers['user-agent']
  )
  req.server.setRefreshCookie(reply, refreshToken)

  return reply.send({ message: 'ok', data: { accessToken } })
}

/** 刷新：校验/旋转 refresh，签发新 access */
export async function refresh(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const token = (req.cookies as Record<string, string> | undefined)?.[ctx.config?.authCookieName]
  ctx.log.debug('refresh token from cookie')
  if (!token) {
    throw new AppError(
      'No refresh token',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  }

  // 验签（refresh 命名空间）；失败时规范化为 401
  try {
    await req.refreshVerify()
  } catch (e) {
    throw new AppError(
      'Invalid refresh token',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED,
      { cause: e }
    )
  }
  const record = await authService.assertRefreshValid(ctx, token)

  const newJti = authService.genJti()
  const newRefresh = await reply.refreshSign({ sub: record.userId, jti: newJti, type: 'refresh' })
  await authService.rotateRefreshToken(
    ctx,
    token,
    record.userId,
    newRefresh,
    newJti,
    req.ip,
    req.headers['user-agent']
  )

  req.server.setRefreshCookie(reply, newRefresh)
  const fresh = await ctx.prisma.user.findUnique({
    where: { id: record.userId },
    select: { role: true, tokenVersion: true },
  })
  const accessToken = await reply.accessSign({
    sub: record.userId,
    role: fresh!.role,
    type: 'access',
    ver: fresh!.tokenVersion,
  })

  return reply.send({ message: 'ok', data: { accessToken } })
}

/** 登出：撤销当前 refresh + 清 cookie */
export async function logout(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const token = (req.cookies as Record<string, string> | undefined)?.[ctx.config?.authCookieName]
  if (token) {
    await authService.revokeRefreshByToken(ctx, token)
  }
  req.server.clearRefreshCookie(reply)
  return reply.status(204).send()
}

/** 当前用户（从 access token 解出） */
export async function me(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const userId = req.user?.sub
  if (!userId) {
    throw new AppError(
      'Unauthorized',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  }

  const profile = await ctx.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!profile) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND.statusCode, ERROR_TYPES.NOT_FOUND, {
      id: userId,
    })
  }

  return reply.send({
    message: 'ok',
    data: {
      user: {
        sub: profile.id,
        role: profile.role,
        type: req.user?.type,
        name: profile.displayName ?? profile.email,
        email: profile.email,
        createdAt: profile.createdAt.toISOString(),
        updatedAt: profile.updatedAt.toISOString(),
      },
    },
  })
}

/** 修改密码：验证旧密码 → 更新哈希 → 撤销所有 refresh（强下线） */
export async function changePassword(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { oldPassword, newPassword } = req.body as ChangePasswordBody
  if (!req.user?.sub) {
    throw new AppError(
      'Unauthorized',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  }

  const user = await ctx.prisma.user.findUnique({ where: { id: req.user.sub } })
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND.statusCode, ERROR_TYPES.NOT_FOUND)
  }
  const ok = await authService.verifyPassword(user.passwordHash, oldPassword)
  if (!ok) {
    throw new AppError(
      'Old password incorrect',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  }

  const newHash = await authService.hashPassword(newPassword)
  await ctx.prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } })
  await authService.revokeAllRefreshOfUser(ctx, user.id)
  await authService.bumpTokenVersion(ctx, user.id)

  return reply.send({ message: 'password changed' })
}
