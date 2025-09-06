import type { Ctx } from '../helpers/context.helper'
import { Queue } from 'bullmq'
import { SYNC_STARS_QUEUE, SYNC_STARS_JOB } from '../constants/queueNames'

/**
 * RefreshToken 清理选项。
 * - expiredCleanAfterDays: 过期后再保留多少天再物理删除
 * - revokedRetentionDays: 撤销后保留天数
 * - batch: 每批删除条数
 * - dryRun: 仅统计不删除
 * - useLock: 是否启用分布式互斥
 * - lockKey / lockTtlSec: 自定义锁键与 TTL
 * @category Maintenance
 */
type CleanupRtOptions = {
  expiredCleanAfterDays?: number
  revokedRetentionDays?: number
  batch?: number
  dryRun?: boolean
  useLock?: boolean
  lockKey?: string
  lockTtlSec?: number
}

/**
 * 清理 RefreshToken：支持过期与撤销分开统计 + 批处理删除；可 dryRun 预览。
 * 可选分布式锁避免多实例并发清理。
 * @returns 预览与实际删除统计结果
 * @category Maintenance
 */
export async function cleanupRefreshTokensService(ctx: Ctx, options: CleanupRtOptions = {}) {
  const expiredCleanAfterDays =
    options.expiredCleanAfterDays ?? ctx.config.rtExpiredCleanAfterDays ?? 0
  const revokedRetentionDays =
    options.revokedRetentionDays ?? ctx.config.rtRevokedRetentionDays ?? 7
  const batch = Math.max(1, options.batch ?? ctx.config.rtCleanBatch ?? 1000)
  const dryRun = options.dryRun ?? ctx.config.rtCleanDryRun ?? true

  // 可选：分布式互斥锁，避免并发执行
  let locked = false
  const lockKey = options.lockKey ?? 'lock:cleanup:rt'

  if (options.useLock) {
    const ttlSec = options.lockTtlSec ?? 1800 // 秒
    const val = String(Date.now()) // 锁的值（可写成实例ID以便诊断）
    const ok = await ctx.redis.set(lockKey, val, 'EX', ttlSec, 'NX')
    if (ok !== 'OK') {
      return {
        dryRun,
        expiredPreview: 0,
        revokedPreview: 0,
        expiredDeleted: 0,
        revokedDeleted: 0,
        locked: true,
        message: 'another cleanup is running',
      }
    }
    locked = true
  }

  const msPerDay = 24 * 60 * 60 * 1000
  const now = Date.now()
  const expiredBefore = new Date(now - expiredCleanAfterDays * msPerDay)
  const revokedBefore = new Date(now - revokedRetentionDays * msPerDay)

  // 预览统计
  const expiredPreview = await ctx.prisma.refreshToken.count({
    where: { expiresAt: { lt: expiredBefore } },
  })
  const revokedPreview = await ctx.prisma.refreshToken.count({
    where: { revoked: true, revokedAt: { lt: revokedBefore } },
  })

  let expiredDeleted = 0
  let revokedDeleted = 0

  if (!dryRun && expiredPreview > 0) {
    let more = true
    while (more) {
      const rows = await ctx.prisma.refreshToken.findMany({
        where: { expiresAt: { lt: expiredBefore } },
        select: { id: true },
        orderBy: { expiresAt: 'asc' },
        take: batch,
      })
      more = rows.length > 0
      if (!more) break
      const ids = rows.map((r) => r.id)
      const res = await ctx.prisma.refreshToken.deleteMany({ where: { id: { in: ids } } })
      expiredDeleted += res.count
      ctx.log.info({ batchDeleted: res.count, expiredDeleted }, '[RT-CLEAN] expired batch')
    }
  }

  if (!dryRun && revokedPreview > 0) {
    let more = true
    while (more) {
      const rows = await ctx.prisma.refreshToken.findMany({
        where: { revoked: true, revokedAt: { lt: revokedBefore } },
        select: { id: true },
        orderBy: { revokedAt: 'asc' },
        take: batch,
      })
      more = rows.length > 0
      if (!more) break
      const ids = rows.map((r) => r.id)
      const res = await ctx.prisma.refreshToken.deleteMany({ where: { id: { in: ids } } })
      revokedDeleted += res.count
      ctx.log.info({ batchDeleted: res.count, revokedDeleted }, '[RT-CLEAN] revoked batch')
    }
  }

  const result = {
    dryRun,
    expiredPreview,
    revokedPreview,
    expiredDeleted,
    revokedDeleted,
  }

  if (locked) await ctx.redis.del(lockKey).catch(() => void 0)
  return result
}

// —— BullMQ 清理 —— //
/**
 * BullMQ 清理选项。
 * - completedAfterDays: 完成 job 保留天数
 * - failedAfterDays: 失败 job 保留天数
 * - trimEventsTo: 事件流裁剪长度
 * - dryRun: 仅统计不修改
 * - queueName: 目标队列
 * - useLock: 分布式锁
 * @category Maintenance
 */
type CleanupBullOpts = {
  dryRun?: boolean
  completedAfterDays?: number
  failedAfterDays?: number
  trimEventsTo?: number
  queueName?: string
  useLock?: boolean
  lockKey?: string
  lockTtlSec?: number
}

/**
 * 清理 BullMQ 队列：过期的 completed/failed 任务、裁剪事件、移除无效 repeatable 任务。
 * 支持 dryRun 与分布式锁。
 * @returns 清理统计
 * @category Maintenance
 */
export async function cleanupBullmqService(ctx: Ctx, opts: CleanupBullOpts = {}) {
  const dryRun = opts.dryRun ?? ctx.config.bullCleanDryRun ?? true
  const completedAfterDays = opts.completedAfterDays ?? ctx.config.bullCleanCompletedAfterDays ?? 3
  const failedAfterDays = opts.failedAfterDays ?? ctx.config.bullCleanFailedAfterDays ?? 30
  const trimEventsTo = Math.max(0, opts.trimEventsTo ?? ctx.config.bullTrimEvents ?? 1000)

  // 可选：锁
  let locked = false
  const lockKey = opts.lockKey ?? 'lock:cleanup:bull'
  if (opts.useLock) {
    const token = `${process.pid}:${Date.now()}`
    const ok = await ctx.redis.set(lockKey, token, 'EX', opts.lockTtlSec ?? 1800, 'NX')
    if (ok !== 'OK') {
      return {
        dryRun,
        queue: SYNC_STARS_QUEUE,
        cleanedCompleted: 0,
        cleanedFailed: 0,
        trimmedEventsTo: trimEventsTo,
        removedRepeatables: 0,
        locked: true,
        message: 'another bull cleanup running',
      }
    }
    locked = true
  }

  const toMs = (d: number) => Math.max(0, Math.floor(d * 24 * 60 * 60 * 1000))
  const connection = {
    host: ctx.config.redisHost,
    port: ctx.config.redisPort,
    password: ctx.config.redisPassword,
    maxRetriesPerRequest: null as unknown as number | null,
    enableReadyCheck: true,
  }

  const queueName = opts.queueName ?? SYNC_STARS_QUEUE
  const queue = new Queue(queueName, { connection, prefix: ctx.config.bullPrefix })
  await queue.waitUntilReady()

  let cleanedCompleted = 0
  let cleanedFailed = 0
  let removedRepeatables = 0

  try {
    if (!dryRun) {
      const c = await queue.clean(toMs(completedAfterDays), 1000, 'completed').catch(() => [])
      const f = await queue.clean(toMs(failedAfterDays), 1000, 'failed').catch(() => [])
      cleanedCompleted = Array.isArray(c) ? c.length : Number(c) || 0
      cleanedFailed = Array.isArray(f) ? f.length : Number(f) || 0
      if (trimEventsTo > 0) await queue.trimEvents(trimEventsTo).catch(() => void 0)
    }

    // repeatable 去重（仅保留当前 cron 的同名任务）
    const repeats = await queue.getRepeatableJobs().catch(() => [])
    for (const r of repeats) {
      const keep =
        r.name === SYNC_STARS_JOB &&
        !!ctx.config.syncStarsCron &&
        r.cron === ctx.config.syncStarsCron
      if (!keep) {
        if (!dryRun) {
          try {
            await queue.removeRepeatableByKey(r.key)
            removedRepeatables += 1
          } catch {
            // ignore
          }
        } else {
          removedRepeatables += 1
        }
      }
    }

    return {
      dryRun,
      queue: queueName,
      cleanedCompleted,
      cleanedFailed,
      trimmedEventsTo: trimEventsTo,
      removedRepeatables,
    }
  } finally {
    await queue.close().catch(() => void 0)
    if (locked) await ctx.redis.del(lockKey).catch(() => void 0)
  }
}
