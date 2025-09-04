// src/services/auth.service.ts
import argon2 from 'argon2'
import { randomUUID, createHash } from 'node:crypto'
import { Ctx } from '../helpers/context.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import { config } from '../config'

function parseDurationMs(input: string): number {
  const m = String(input || '')
    .trim()
    .match(/^(\d+)\s*(ms|s|m|h|d)?$/i)
  if (!m) return 0
  const n = Number(m[1])
  const u = (m[2] || 's').toLowerCase()
  switch (u) {
    case 'ms':
      return n
    case 's':
      return n * 1_000
    case 'm':
      return n * 60_000
    case 'h':
      return n * 3_600_000
    case 'd':
      return n * 86_400_000
    default:
      return n * 1_000
  }
}
const REFRESH_EXPIRES_MS = parseDurationMs(config.jwtRefreshExpires)

export function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

export async function hashPassword(plain: string) {
  return argon2.hash(plain)
}
export async function verifyPassword(hash: string, plain: string) {
  return argon2.verify(hash, plain)
}

export async function findUserByEmail(ctx: Ctx, email: string) {
  return ctx.prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, role: true, tokenVersion: true },
  })
}
export async function createUser(ctx: Ctx, email: string, password: string, displayName?: string) {
  const existed = await ctx.prisma.user.findUnique({ where: { email } })
  if (existed) {
    throw new AppError(
      'Email already registered',
      HTTP_STATUS.CONFLICT.statusCode,
      ERROR_TYPES.CONFLICT,
      { email }
    )
  }
  const passwordHash = await hashPassword(password)
  return ctx.prisma.user.create({ data: { email, passwordHash, displayName } })
}

export async function persistRefreshToken(
  ctx: Ctx,
  userId: string,
  refreshToken: string,
  jti: string,
  ip?: string,
  ua?: string
) {
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS)
  return ctx.prisma.refreshToken.create({
    data: { userId, tokenHash: sha256(refreshToken), jti, expiresAt, ip, userAgent: ua },
  })
}

export async function assertRefreshValid(ctx: Ctx, refreshToken: string) {
  const hash = sha256(refreshToken)
  const record = await ctx.prisma.refreshToken.findUnique({ where: { tokenHash: hash } })
  if (!record)
    throw new AppError(
      'Refresh token not found',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  if (record.revoked)
    throw new AppError(
      'Refresh token revoked',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  if (record.expiresAt <= new Date()) {
    throw new AppError(
      'Refresh token expired',
      HTTP_STATUS.UNAUTHORIZED.statusCode,
      ERROR_TYPES.UNAUTHORIZED
    )
  }
  return record
}

export async function rotateRefreshToken(
  ctx: Ctx,
  oldToken: string,
  userId: string,
  newToken: string,
  newJti: string,
  ip?: string,
  ua?: string
) {
  const oldHash = sha256(oldToken)
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_MS)
  await ctx.prisma.$transaction([
    ctx.prisma.refreshToken.update({
      where: { tokenHash: oldHash },
      data: { revoked: true, replacedByTokenId: newJti, revokedAt: new Date() },
    }),
    ctx.prisma.refreshToken.create({
      data: { userId, tokenHash: sha256(newToken), jti: newJti, expiresAt, ip, userAgent: ua },
    }),
  ])
}

export async function revokeRefreshByToken(ctx: Ctx, token: string) {
  const hash = sha256(token)
  await ctx.prisma.refreshToken
    .update({ where: { tokenHash: hash }, data: { revoked: true, revokedAt: new Date() } })
    .catch(() => void 0)
}

export async function revokeAllRefreshOfUser(ctx: Ctx, userId: string) {
  await ctx.prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  })
}

export function genJti() {
  return randomUUID()
}

// tokenVersion helpers
export async function bumpTokenVersion(ctx: Ctx, userId: string) {
  const updated = await ctx.prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  })
  // cache to Redis for quick verify
  await ctx.redis.set(`tv:${userId}`, String(updated.tokenVersion), 'EX', 1800).catch(() => void 0)
  return updated.tokenVersion
}

export async function cacheTokenVersion(ctx: Ctx, userId: string, version: number) {
  await ctx.redis.set(`tv:${userId}`, String(version), 'EX', 1800).catch(() => void 0)
}
