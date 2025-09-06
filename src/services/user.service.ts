// src/services/user.service.ts
import { Ctx } from '../helpers/context.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'

/**
 * 变更用户角色并强制使现有会话失效：
 * 1. 更新 `user.role`
 * 2. 撤销用户全部有效 RefreshToken
 * 3. tokenVersion 自增 & 写入 Redis，确保已签发 AccessToken 立即失效
 *
 * 安全考量：角色提升/降级需让既有访问权限即时过期。
 *
 * @param ctx 上下文
 * @param userId 用户 ID
 * @param role 目标角色
 * @throws {AppError} 用户不存在 (404)
 * @returns `{ ok: true }`
 * @category User
 */
export async function setUserRole(ctx: Ctx, userId: string, role: 'USER' | 'ADMIN') {
  const user = await ctx.prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('User not found', HTTP_STATUS.NOT_FOUND.statusCode, ERROR_TYPES.NOT_FOUND, {
      userId,
    })
  }
  // 变更角色
  await ctx.prisma.user.update({ where: { id: userId }, data: { role } })
  // 可选：立刻让所有会话失效（更安全）
  await ctx.prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true, revokedAt: new Date() },
  })
  // tokenVersion +1，实现 access 立刻失效，并更新 Redis 缓存
  const updated = await ctx.prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  })
  await ctx.redis.set(`tv:${userId}`, String(updated.tokenVersion), 'EX', 1800).catch(() => void 0)
  return { ok: true }
}
