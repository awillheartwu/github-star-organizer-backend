// src/plugins/bullmq.ts
import fp from 'fastify-plugin'
import { Queue, Worker, QueueEvents } from 'bullmq'
import {
  SYNC_STARS_JOB,
  SYNC_STARS_QUEUE,
  MAINTENANCE_JOB,
  MAINTENANCE_QUEUE,
} from '../constants/queueNames'
import type { SyncJobData, SyncStats } from '../types/sync.types'
import type { Ctx } from '../helpers/context.helper'
import { handleSyncStarsJob } from '../services/github/githubStar.service'
import * as notify from '../services/notify.service'
import { cleanupRefreshTokensService, cleanupBullmqService } from '../services/maintenance.service'

export default fp(
  async (app) => {
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

    // 可选启动 Worker（按角色）
    let worker: Worker<SyncJobData, SyncStats> | undefined
    let maintWorker: Worker | undefined
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
          app.log.info('[maintenance] daily cleanup start')
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
          return { r1, r2 }
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
    } else {
      app.log.info(`[BullMQ] bullRole=${app.config.bullRole}; worker not started`)
    }

    // 等待就绪，确保连接可用
    await Promise.all([
      syncStarsQueue.waitUntilReady(),
      syncStarsEvents.waitUntilReady(),
      ...(worker ? [worker.waitUntilReady()] : []),
      ...(maintWorker ? [maintWorker.waitUntilReady()] : []),
    ])

    // 注册定时（repeatable）增量任务（按配置），使用固定 jobId 防重复
    if (isProducer && app.config.syncStarsCron) {
      await syncStarsQueue.add(
        SYNC_STARS_JOB,
        { options: { mode: 'incremental' }, actor: 'cron', note: 'scheduled by cron' },
        { jobId: 'sync-stars:cron', repeat: { pattern: app.config.syncStarsCron } }
      )
      app.log.info(`[BullMQ] repeatable job registered with cron: ${app.config.syncStarsCron}`)
    }

    // 注册维护任务（可配置开关）
    if (isProducer && app.config.maintEnabled) {
      await maintenanceQueue.add(
        MAINTENANCE_JOB,
        { actor: 'cron' },
        { jobId: 'maintenance:daily', repeat: { pattern: app.config.maintCron } }
      )
      app.log.info(`[BullMQ] maintenance job registered with cron: ${app.config.maintCron}`)
    }

    // 装饰 fastify 实例，方便在 Controller/Service 使用
    app.decorate('queues', {
      syncStars: syncStarsQueue,
      maintenance: maintenanceQueue,
    })
    if (worker || maintWorker) {
      app.decorate('workers', {
        syncStars: worker!,
        maintenance: maintWorker!,
      })
    }

    app.addHook('onClose', async () => {
      if (worker) await worker.close()
      if (maintWorker) await maintWorker.close()
      await syncStarsEvents.close()
      await syncStarsQueue.close()
      await maintenanceQueue.close()
    })
  },
  // 依赖 prisma/mailer，确保 worker 中可用 app.prisma 与 app.mailer（通知）
  { name: 'bullmq', dependencies: ['redis', 'config', 'prisma', 'mailer'] }
)
