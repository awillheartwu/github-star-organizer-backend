// src/services/user.service.ts
import { Ctx } from '../helpers/context.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'

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
    data: { revoked: true },
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
