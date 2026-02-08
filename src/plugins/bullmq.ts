// src/plugins/bullmq.ts
import fp from 'fastify-plugin'
import { Queue, Worker, QueueEvents } from 'bullmq'
import {
  SYNC_STARS_JOB,
  SYNC_STARS_QUEUE,
  MAINTENANCE_JOB,
  MAINTENANCE_QUEUE,
} from '../constants/queueNames'
import { AI_SUMMARY_QUEUE, AI_SUMMARY_JOB, AI_SWEEP_JOB } from '../constants/queueNames'
import type { SyncJobData, SyncStats } from '../types/sync.types'
import type { Ctx } from '../helpers/context.helper'
// Lazy-load to avoid importing ESM-only Octokit during Jest CJS runtime
// import { handleSyncStarsJob } from '../services/github/githubStar.service'
import * as notify from '../services/notify.service'
import { cleanupRefreshTokensService, cleanupBullmqService } from '../services/maintenance.service'
import * as aiService from '../services/ai.service'
import { ensureState, markError, markSuccess, touchRun } from '../services/sync.state.service'

export default fp(
  async (app) => {
    // ---- helpers ----
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const makeCtx = (): Ctx => ({
      prisma: app.prisma,
      log: app.log,
      config: app.config,
      redis: app.redis,
    })
    const sanitizeSegment = (value: string) => value.replace(/:/g, '-')
    async function awaitAiRateLimit() {
      const limit = app.config.aiRpmLimit
      if (!limit || limit <= 0) return
      // simple token bucket on per-minute window (bounded wait loop)
      let waits = 0
      const maxWaits = 120 // up to ~2 minutes
      while (waits < maxWaits) {
        const now = Date.now()
        const minute = Math.floor(now / 60000)
        const ttl = 60 - Math.floor((now - minute * 60000) / 1000)
        const key = `rl:ai:${minute}`
        let n = 0
        try {
          n = await app.redis.incr(key)
          if (n === 1) await app.redis.expire(key, 60)
        } catch {
          // if redis unavailable, do not block
          return
        }
        if (n <= limit) return
        // rollback best-effort to not consume token (optional, ignore errors)
        try {
          await app.redis.decr(key)
        } catch (_e) {
          void 0
        }
        const waitMs = Math.max(200, ttl * 1000 + 50)
        await sleep(waitMs)
        waits += 1
      }
    }
    // BullMQ 独立 Redis 连接（避免与 Pub/Sub/阻塞命令冲突）
    const connection = {
      host: app.config.redisHost,
      port: app.config.redisPort,
      password: app.config.redisPassword,
      // BullMQ 推荐将 maxRetriesPerRequest 设为 null 以避免命令重试导致的阻塞
      // 以及启用 ready 检查
      maxRetriesPerRequest: null as unknown as number | null,
      enableReadyCheck: true,
    }

    // 运行角色：both/worker/producer
    const isWorker = app.config.bullRole === 'both' || app.config.bullRole === 'worker'
    const isProducer = app.config.bullRole === 'both' || app.config.bullRole === 'producer'

    // 创建队列（含默认作业策略）
    const syncStarsQueue = new Queue<SyncJobData, SyncStats>(SYNC_STARS_QUEUE, {
      connection,
      prefix: app.config.bullPrefix,
      defaultJobOptions: {
        attempts: app.config.syncJobAttempts ?? 3,
        backoff: { type: 'fixed', delay: app.config.syncJobBackoffMs ?? 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    })

    // 维护队列（用于每日清理）
    const maintenanceQueue = new Queue(MAINTENANCE_QUEUE, {
      connection,
      prefix: app.config.bullPrefix,
      defaultJobOptions: { removeOnComplete: 100, removeOnFail: 500 },
    })

    // AI 摘要队列
    const aiSummaryQueue = new Queue(AI_SUMMARY_QUEUE, {
      connection,
      prefix: app.config.bullPrefix,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'fixed', delay: 30_000 },
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    })

    // 队列事件（可用于日志/监控）
    const syncStarsEvents = new QueueEvents(SYNC_STARS_QUEUE, {
      connection,
      prefix: app.config.bullPrefix,
    })
    syncStarsEvents.on('completed', ({ jobId }) => {
      app.log.info(`[BullMQ] Job ${jobId} completed`)
    })
    syncStarsEvents.on('failed', ({ jobId, failedReason }) => {
      app.log.error(`[BullMQ] Job ${jobId} failed: ${failedReason}`)
    })
    syncStarsEvents.on('error', (err) => {
      app.log.error({ err }, '[BullMQ] QueueEvents error')
    })

    const aiEvents = new QueueEvents(AI_SUMMARY_QUEUE, {
      connection,
      prefix: app.config.bullPrefix,
    })
    aiEvents.on('completed', ({ jobId }) => app.log.info(`[AI] job ${jobId} completed`))
    aiEvents.on('failed', ({ jobId, failedReason }) =>
      app.log.error(`[AI] job ${jobId} failed: ${failedReason}`)
    )
    aiEvents.on('error', (err) => app.log.error({ err }, '[AI] QueueEvents error'))

    // 可选启动 Worker（按角色）
    let worker: Worker<SyncJobData, SyncStats> | undefined
    let maintWorker: Worker | undefined
    let aiWorker: Worker | undefined
    if (isWorker) {
      worker = new Worker<SyncJobData, SyncStats>(
        SYNC_STARS_QUEUE,
        async (job) => {
          app.log.info(`[BullMQ] Processing job ${job.id} (${job.name})`)
          if (job.name !== SYNC_STARS_JOB) {
            throw new Error(`Unknown job name: ${job.name}`)
          }

          const ctx: Ctx = {
            prisma: app.prisma,
            log: app.log,
            config: app.config,
            redis: app.redis,
          }
          // Dynamic import to decouple ESM-only dependencies from test environment
          const { handleSyncStarsJob } = await import('../services/github/githubStar.service')
          const stats = await handleSyncStarsJob(ctx, job.data)
          return stats
        },
        {
          connection,
          prefix: app.config.bullPrefix,
          concurrency: app.config.syncConcurrency ?? 1,
        }
      )
      worker.on('error', (err) => {
        app.log.error({ err }, '[BullMQ] Worker error')
      })
      worker.on('completed', async (job, result) => {
        app.log.info({ jobId: job.id, result }, '[BullMQ] Worker completed job')
        try {
          await notify.sendSyncCompleted(app, job.id!, result as SyncStats)
        } catch (e) {
          app.log.warn({ e }, '[BullMQ] notify completed mail failed')
        }
      })
      worker.on('failed', async (job, err) => {
        app.log.error({ jobId: job?.id, err }, '[BullMQ] Worker failed job')
        try {
          // 仅在“最终失败”时发送邮件，避免重试阶段多封通知
          const attemptsMade = job?.attemptsMade ?? 0
          const maxAttempts =
            (job?.opts?.attempts as number | undefined) ?? app.config.syncJobAttempts ?? 1
          const isFinalFailure = attemptsMade >= maxAttempts
          if (isFinalFailure && job?.id) {
            await notify.sendSyncFailed(app, job.id, err)
          } else {
            app.log.debug({ attemptsMade, maxAttempts }, '[BullMQ] skip fail mail (will retry)')
          }
        } catch (e) {
          app.log.warn({ e }, '[BullMQ] notify failed mail failed')
        }
      })

      // 维护 worker（并发 1）
      maintWorker = new Worker(
        MAINTENANCE_QUEUE,
        async (job) => {
          if (job.name !== MAINTENANCE_JOB) throw new Error(`Unknown job name: ${job.name}`)
          const ctx: Ctx = {
            prisma: app.prisma,
            log: app.log,
            config: app.config,
            redis: app.redis,
          }
          const source = 'maintenance'
          const key = 'daily:default'
          const startedAt = new Date()
          await ensureState(ctx, source, key)
          await touchRun(ctx, source, key, startedAt)
          app.log.info('[maintenance] daily cleanup start')
          try {
            const r1 = await cleanupRefreshTokensService(ctx, { useLock: true })
            const r2 = await cleanupBullmqService(ctx, { useLock: true })
            app.log.info({ r1, r2 }, '[maintenance] daily cleanup done')
            // fire-and-forget 邮件避免阻塞完成事件
            ;(async () => {
              try {
                await notify.sendMaintenanceCompleted(
                  app,
                  job.id!,
                  r1,
                  {
                    dryRun: app.config.bullCleanDryRun ?? true,
                    queue: SYNC_STARS_QUEUE,
                    cleanedCompleted: 0,
                    cleanedFailed: 0,
                    trimmedEventsTo: app.config.bullTrimEvents ?? 1000,
                    removedRepeatables: 0,
                  },
                  app.config
                )
              } catch (e) {
                app.log.warn({ e }, '[maintenance] notify mail failed')
              }
            })()
            const finishedAt = new Date()
            await markSuccess(ctx, source, key, {
              stats: {
                scanned: 0,
                created: 0,
                updated: 0,
                unchanged: 0,
                softDeleted: 0,
                pages: 1,
                startedAt: startedAt.toISOString(),
                finishedAt: finishedAt.toISOString(),
                durationMs: finishedAt.getTime() - startedAt.getTime(),
                maintenance: { r1, r2 },
              } as unknown as SyncStats,
              finishedAt,
            })
            return { r1, r2 }
          } catch (e) {
            await markError(ctx, source, key, e)
            throw e
          }
        },
        { connection, prefix: app.config.bullPrefix, concurrency: 1 }
      )
      maintWorker.on('error', (err) => app.log.error({ err }, '[BullMQ] Maint worker error'))
      maintWorker.on('failed', async (job, err) => {
        try {
          await notify.sendMaintenanceFailed(app, job?.id || 'maintenance', err)
        } catch (e) {
          app.log.warn({ e }, '[maintenance] notify fail mail failed')
        }
      })

      // AI 摘要/扫描 worker（统一处理两个作业名，避免同队列多 worker 抢占）
      type AiJobData =
        | {
            // ai-summary
            projectId: string
            batchId?: string
            options?: {
              style?: 'short' | 'long' | 'both'
              lang?: 'zh' | 'en'
              model?: string
              temperature?: number
              createTags?: boolean
              includeReadme?: boolean
              readmeMaxChars?: number
              overwrite?: boolean
            }
          }
        | {
            // ai-sweep
            limit?: number
            lang?: 'zh' | 'en'
            model?: string
            force?: boolean
            staleDaysOverride?: number
          }
      aiWorker = new Worker<AiJobData>(
        AI_SUMMARY_QUEUE,
        async (job) => {
          if (job.name === AI_SUMMARY_JOB) {
            const { projectId, options, batchId } = job.data as Extract<
              AiJobData,
              { projectId: string; batchId?: string }
            >
            try {
              // 速率限制：每分钟请求上限（全局）
              await awaitAiRateLimit()
              const out = await aiService.summarizeProject(app, projectId, {
                ...options,
                readmeMaxChars: options?.readmeMaxChars ?? app.config.aiReadmeMaxChars ?? 4000,
              })
              // 若属于批处理：在 Redis 累加统计并在全部完成时发送一封汇总邮件
              if (batchId) {
                try {
                  const bk = `ai:batch:${batchId}`
                  await app.redis.hincrby(bk, 'ok', 1)
                  const done = await app.redis.hincrby(bk, 'done', 1)
                  // 采样记录前 20 条成功项
                  const p = await app.prisma.project.findUnique({
                    where: { id: projectId },
                    select: { id: true, name: true, url: true },
                  })
                  await app.redis.lpush(
                    `${bk}:ok`,
                    JSON.stringify({
                      id: p?.id || projectId,
                      name: p?.name || '',
                      url: p?.url || '',
                    })
                  )
                  await app.redis.ltrim(`${bk}:ok`, 0, 19)
                  const [totalStr] = await app.redis.hmget(bk, 'total')
                  const total = Number(totalStr || '0')
                  if (total > 0 && done >= total) {
                    const [okStr, failStr, startedAtStr, lang, model] = await app.redis.hmget(
                      bk,
                      'ok',
                      'fail',
                      'startedAt',
                      'lang',
                      'model'
                    )
                    const ok = Number(okStr || '0')
                    const fail = Number(failStr || '0')
                    const startedAt = Number(startedAtStr || '0')
                    const finishedAt = Date.now()
                    const okListRaw = await app.redis.lrange(`${bk}:ok`, 0, 19)
                    const failListRaw = await app.redis.lrange(`${bk}:fail`, 0, 19)
                    const okList = okListRaw
                      .map((s) => {
                        try {
                          return JSON.parse(s)
                        } catch {
                          return null
                        }
                      })
                      .filter(Boolean) as Array<{ id: string; name: string; url?: string }>
                    const failList = failListRaw
                      .map((s) => {
                        try {
                          return JSON.parse(s)
                        } catch {
                          return null
                        }
                      })
                      .filter(Boolean) as Array<{ id: string; name: string; error?: string }>
                    await notify.sendAiBatchCompleted(app, batchId, {
                      total,
                      ok,
                      fail,
                      startedAt,
                      finishedAt,
                      lang: lang || undefined,
                      model: model || undefined,
                      okList,
                      failList,
                    })
                    // 同步写入 SyncState 作为持久批次记录
                    try {
                      const key = `batch:${batchId}`
                      const ctx = makeCtx()
                      await ensureState(ctx, 'ai:summary', key)
                      await touchRun(ctx, 'ai:summary', key, new Date(startedAt || Date.now()))
                      await markSuccess(ctx, 'ai:summary', key, {
                        finishedAt: new Date(finishedAt),
                        stats: {
                          scanned: total,
                          created: ok,
                          updated: 0,
                          unchanged: 0,
                          softDeleted: 0,
                          pages: 1,
                          startedAt: new Date(startedAt || finishedAt).toISOString(),
                          finishedAt: new Date(finishedAt).toISOString(),
                          durationMs: finishedAt - (startedAt || finishedAt),
                        } as unknown as SyncStats,
                      })
                    } catch (e) {
                      app.log.warn({ e }, '[AI] write batch SyncState failed')
                    }
                    await app.redis.del(bk, `${bk}:ok`, `${bk}:fail`).catch(() => void 0)
                  }
                } catch (e) {
                  app.log.warn({ e }, '[AI] batch counter update failed')
                }
              }
              return out
            } catch (e) {
              // 标记错误元数据（软失败记录）
              try {
                await app.prisma.project.update({
                  where: { id: projectId },
                  data: {
                    aiSummaryError: (e as Error)?.message ?? String(e),
                    aiSummaryErrorAt: new Date(),
                  },
                })
              } catch {
                // ignore
              }
              // 若属于批处理：记录失败并检查是否全部完成
              if (batchId) {
                const bk = `ai:batch:${batchId}`
                try {
                  await app.redis.hincrby(bk, 'fail', 1)
                  const done = await app.redis.hincrby(bk, 'done', 1)
                  const p = await app.prisma.project.findUnique({
                    where: { id: projectId },
                    select: { id: true, name: true },
                  })
                  await app.redis.lpush(
                    `${bk}:fail`,
                    JSON.stringify({
                      id: p?.id || projectId,
                      name: p?.name || '',
                      error: (e as Error)?.message || String(e),
                    })
                  )
                  await app.redis.ltrim(`${bk}:fail`, 0, 19)
                  const [totalStr] = await app.redis.hmget(bk, 'total')
                  const total = Number(totalStr || '0')
                  if (total > 0 && done >= total) {
                    const [okStr, failStr, startedAtStr, lang, model] = await app.redis.hmget(
                      bk,
                      'ok',
                      'fail',
                      'startedAt',
                      'lang',
                      'model'
                    )
                    const ok = Number(okStr || '0')
                    const fail = Number(failStr || '0')
                    const startedAt = Number(startedAtStr || '0')
                    const finishedAt = Date.now()
                    const okListRaw = await app.redis.lrange(`${bk}:ok`, 0, 19)
                    const failListRaw = await app.redis.lrange(`${bk}:fail`, 0, 19)
                    const okList = okListRaw
                      .map((s) => {
                        try {
                          return JSON.parse(s)
                        } catch {
                          return null
                        }
                      })
                      .filter(Boolean) as Array<{ id: string; name: string; url?: string }>
                    const failList = failListRaw
                      .map((s) => {
                        try {
                          return JSON.parse(s)
                        } catch {
                          return null
                        }
                      })
                      .filter(Boolean) as Array<{ id: string; name: string; error?: string }>
                    await notify.sendAiBatchCompleted(app, batchId, {
                      total,
                      ok,
                      fail,
                      startedAt,
                      finishedAt,
                      lang: lang || undefined,
                      model: model || undefined,
                      okList,
                      failList,
                    })
                    // 同步写入 SyncState 作为持久批次记录
                    try {
                      const key = `batch:${batchId}`
                      const ctx = makeCtx()
                      await ensureState(ctx, 'ai:summary', key)
                      await touchRun(ctx, 'ai:summary', key, new Date(startedAt || Date.now()))
                      await markSuccess(ctx, 'ai:summary', key, {
                        finishedAt: new Date(finishedAt),
                        stats: {
                          scanned: total,
                          created: ok,
                          updated: 0,
                          unchanged: 0,
                          softDeleted: 0,
                          pages: 1,
                          startedAt: new Date(startedAt || finishedAt).toISOString(),
                          finishedAt: new Date(finishedAt).toISOString(),
                          durationMs: finishedAt - (startedAt || finishedAt),
                        } as unknown as SyncStats,
                      })
                    } catch (e) {
                      app.log.warn({ e }, '[AI] write batch SyncState failed')
                    }
                    await app.redis.del(bk, `${bk}:ok`, `${bk}:fail`).catch(() => void 0)
                  }
                } catch {
                  // ignore
                }
              }
              throw e
            }
            return
          }

          if (job.name === AI_SWEEP_JOB) {
            const data = job.data as Extract<
              AiJobData,
              { limit?: number } & { force?: boolean; staleDaysOverride?: number }
            >
            const defaultLimit = app.config.aiSummaryLimit
            const limit = Math.max(1, Math.min(800, data?.limit ?? defaultLimit))
            const useForce = !!data?.force
            const staleDaysCfg = app.config.aiSummaryStaleDays ?? 365
            const staleDays = Math.max(0, data?.staleDaysOverride ?? staleDaysCfg)
            const staleBefore = new Date(Date.now() - staleDays * 24 * 3600 * 1000)

            const where = useForce
              ? { archived: false }
              : {
                  archived: false,
                  OR: [{ aiSummarizedAt: null }, { aiSummarizedAt: { lt: staleBefore } }],
                }
            const candidates = await app.prisma.project.findMany({
              where,
              select: { id: true },
              orderBy: { updatedAt: 'desc' },
              take: limit,
            })

            // 初始化批处理计数（batchId 使用 sweep jobId）
            const batchId = String(job.id)
            const bk = `ai:batch:${batchId}`
            if (candidates.length === 0) {
              // 无候选：直接发送一封空汇总邮件
              await notify.sendAiBatchCompleted(app, batchId, {
                total: 0,
                ok: 0,
                fail: 0,
                startedAt: Date.now(),
                finishedAt: Date.now(),
                lang: data?.lang || '',
                model: data?.model || '',
                okList: [],
                failList: [],
              })
            } else {
              await app.redis.hset(bk, {
                total: candidates.length,
                done: 0,
                ok: 0,
                fail: 0,
                startedAt: Date.now(),
                lang: data?.lang || '',
                model: data?.model || '',
              })
            }
            let enqueued = 0
            for (const p of candidates) {
              const langSegment = sanitizeSegment(data?.lang ?? 'any')
              const modelSegment = sanitizeSegment(data?.model ?? 'default')
              const jobId = `ai-summary:${p.id}:${langSegment}-${modelSegment}`
              const existed = await aiSummaryQueue.getJob(jobId)
              if (existed) {
                const state = await existed.getState().catch(() => 'unknown')
                // 正在运行/等待中的任务：跳过；已完成/失败：允许重跑（先移除再入列）
                const runningStates = new Set([
                  'waiting',
                  'active',
                  'delayed',
                  'paused',
                  'waiting-children',
                ])
                if (!runningStates.has(state)) {
                  try {
                    await existed.remove()
                  } catch {
                    // ignore remove error
                  }
                } else {
                  continue
                }
              }
              await aiSummaryQueue.add(
                AI_SUMMARY_JOB,
                { projectId: p.id, options: { lang: data?.lang, model: data?.model }, batchId },
                { jobId }
              )
              enqueued += 1
            }
            app.log.info({ enqueued, total: candidates.length }, '[AI] sweep enqueued')
            try {
              await ensureState(app, 'ai:summary', 'all')
              await markSuccess(app, 'ai:summary', 'all', {
                stats: {
                  pages: 1,
                  scanned: candidates.length,
                  created: 0,
                  updated: 0,
                  unchanged: 0,
                  softDeleted: 0,
                },
                finishedAt: new Date(),
              })
            } catch {
              // ignore
            }
            return { enqueued, total: candidates.length }
          }

          throw new Error(`Unknown job name: ${job.name}`)
        },
        {
          connection,
          prefix: app.config.bullPrefix,
          concurrency: Math.max(1, app.config.aiSummaryConcurrency ?? 1),
        }
      )
      aiWorker.on('error', (err) => app.log.error({ err }, '[AI] Worker error'))
      aiWorker.on('completed', async () => {
        // 抑制逐项目与 sweep 完成邮件；由批处理统计在全部完成时发送一封汇总
      })
      aiWorker.on('failed', async (job, err) => {
        try {
          const attemptsMade = job?.attemptsMade ?? 0
          const maxAttempts = (job?.opts?.attempts as number | undefined) ?? 3
          const isFinalFailure = attemptsMade >= maxAttempts
          if (isFinalFailure && job?.id && job.name === AI_SWEEP_JOB) {
            await notify.sendAiSweepFailed(app, job.id, err)
          }
        } catch (e) {
          app.log.warn({ e }, '[AI] notify fail mail failed')
        }
      })
    } else {
      app.log.info(`[BullMQ] bullRole=${app.config.bullRole}; worker not started`)
    }

    // 等待就绪，确保连接可用
    await Promise.all([
      syncStarsQueue.waitUntilReady(),
      syncStarsEvents.waitUntilReady(),
      ...(worker ? [worker.waitUntilReady()] : []),
      ...(maintWorker ? [maintWorker.waitUntilReady()] : []),
      ...(aiWorker ? [aiWorker.waitUntilReady()] : []),
    ])

    // 注册定时（repeatable）增量任务（按配置），使用固定 jobId 防重复
    if (isProducer && app.config.syncStarsCron) {
      await syncStarsQueue.add(
        SYNC_STARS_JOB,
        { options: { mode: 'incremental' }, actor: 'cron', note: 'scheduled by cron' },
        { jobId: 'sync-stars:cron:default', repeat: { pattern: app.config.syncStarsCron } }
      )
      app.log.info(`[BullMQ] repeatable job registered with cron: ${app.config.syncStarsCron}`)
    }

    // 注册维护任务（可配置开关）
    if (isProducer && app.config.maintEnabled) {
      await maintenanceQueue.add(
        MAINTENANCE_JOB,
        { actor: 'cron' },
        { jobId: 'maintenance:daily:default', repeat: { pattern: app.config.maintCron } }
      )
      app.log.info(`[BullMQ] maintenance job registered with cron: ${app.config.maintCron}`)
    }

    // 注册 AI 扫描任务（可配置开关）
    if (isProducer && app.config.aiSummaryCron) {
      await aiSummaryQueue.add(
        AI_SWEEP_JOB,
        { lang: 'zh' },
        { jobId: 'ai-sweep:cron:default', repeat: { pattern: app.config.aiSummaryCron } }
      )
      app.log.info(`[AI] sweep job registered with cron: ${app.config.aiSummaryCron}`)
    }

    // 装饰 fastify 实例，方便在 Controller/Service 使用
    app.decorate('queues', {
      syncStars: syncStarsQueue,
      maintenance: maintenanceQueue,
      aiSummary: aiSummaryQueue,
    })
    // Always expose a workers object for uniform access in tests and runtime
    app.decorate('workers', {
      syncStars: worker as unknown as Worker<SyncJobData, SyncStats> | undefined,
      maintenance: maintWorker as unknown as Worker | undefined,
      aiSummary: aiWorker as unknown as Worker | undefined,
    })

    app.addHook('onClose', async () => {
      if (worker) await worker.close()
      if (maintWorker) await maintWorker.close()
      if (aiWorker) await aiWorker.close()
      await syncStarsEvents.close()
      await aiEvents.close()
      await syncStarsQueue.close()
      await maintenanceQueue.close()
      await aiSummaryQueue.close()
    })
  },
  // 仅强制依赖 config；其余依赖通过实例属性注入（测试可直接装饰 stub）
  { name: 'bullmq', dependencies: ['config'] }
)
