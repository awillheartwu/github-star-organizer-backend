// src/services/auth.service.ts
import argon2 from 'argon2'
import { randomUUID, createHash } from 'node:crypto'
import { Ctx } from '../helpers/context.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import { config } from '../config'

/**
 * @internal 将简单的“数字+单位”持续时间字符串解析为毫秒。
 * 支持：ms / s / m / h / d；默认单位为秒。
 * 不符合格式返回 0。
 */
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
/** @internal Refresh Token 过期时间（毫秒） */
const REFRESH_EXPIRES_MS = parseDurationMs(config.jwtRefreshExpires)

/**
 * 计算字符串的 SHA-256 十六进制摘要。
 * @param input 原始字符串
 * @returns 64 字节十六进制哈希
 * @category Auth
 * @internal 用于 RefreshToken 持久化时只存储哈希，避免明文泄露。
 */
export function sha256(input: string) {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * 使用 Argon2 哈希用户密码。
 * @param plain 明文密码
 * @returns 哈希后的字符串（含参数）
 * @category Auth
 */
export async function hashPassword(plain: string) {
  return argon2.hash(plain)
}
/**
 * 校验密码是否匹配给定 Argon2 哈希。
 * @param hash 已存储的哈希
 * @param plain 待校验明文
 * @returns 是否匹配
 * @category Auth
 */
export async function verifyPassword(hash: string, plain: string) {
  return argon2.verify(hash, plain)
}

/**
 * 按邮箱查找用户（仅选择认证必要字段）。
 * @param ctx 上下文
 * @param email 邮箱
 * @returns 用户基础字段或 null
 * @category Auth
 */
export async function findUserByEmail(ctx: Ctx, email: string) {
  return ctx.prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true, role: true, tokenVersion: true },
  })
}
/**
 * 创建新用户：
 * - 检查邮箱唯一
 * - Argon2 加密密码
 *
 * @throws {AppError} 邮箱已存在 (409)
 * @category Auth
 */
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

/**
 * 持久化新的 Refresh Token 记录（仅保存哈希），用于首次登录或换发。
 * @param ctx 上下文
 * @param userId 用户 ID
 * @param refreshToken 原始 Refresh Token（不会入库）
 * @param jti 令牌唯一标识（用于追踪链）
 * @param ip 可选发起 IP
 * @param ua 可选 UA
 * @category Auth
 */
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

/**
 * 校验 Refresh Token：存在性、未撤销、未过期。
 *
 * @param ctx 上下文
 * @param refreshToken 原始 Token（用于计算哈希）
 * @returns RefreshToken 记录
 * @throws {AppError} 未找到/撤销/过期 (401)
 * @category Auth
 */
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

/**
 * 刷新流中的令牌轮换：撤销旧 RT 并创建新 RT（同一事务保证链一致）。
 *
 * @param ctx 上下文
 * @param oldToken 旧 Refresh Token（原始）
 * @param userId 用户 ID
 * @param newToken 新的 Refresh Token（原始）
 * @param newJti 新 JTI
 * @param ip 可选 IP
 * @param ua 可选 UA
 * @category Auth
 */
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

/**
 * 按原始 Refresh Token 撤销（忽略错误）。
 * @category Auth
 */
export async function revokeRefreshByToken(ctx: Ctx, token: string) {
  const hash = sha256(token)
  await ctx.prisma.refreshToken
    .update({ where: { tokenHash: hash }, data: { revoked: true, revokedAt: new Date() } })
    .catch(() => void 0)
}

/**
 * 撤销用户所有未撤销 RT（用于强制下线或权限变更）。
 * @category Auth
 */
export async function revokeAllRefreshOfUser(ctx: Ctx, userId: string) {
  await ctx.prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  })
}

/**
 * 生成新的 JTI（UUID v4）。
 * @category Auth
 */
export function genJti() {
  return randomUUID()
}

// tokenVersion helpers
/**
 * tokenVersion +1 并缓存到 Redis（使之前签发的 Access Token 立即失效）。
 * @returns 新的 tokenVersion
 * @category Auth
 */
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

/**
 * 手动刷新 Redis 中的 tokenVersion 缓存（例如登录阶段或缓存丢失补全）。
 * @category Auth
 */
export async function cacheTokenVersion(ctx: Ctx, userId: string, version: number) {
  await ctx.redis.set(`tv:${userId}`, String(version), 'EX', 1800).catch(() => void 0)
}
