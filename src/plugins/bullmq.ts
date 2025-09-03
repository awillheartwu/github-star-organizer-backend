// src/plugins/bullmq.ts
import fp from 'fastify-plugin'
import { Queue, Worker, QueueEvents } from 'bullmq'
import { SYNC_STARS_JOB, SYNC_STARS_QUEUE } from '../constants/queueNames'
import type { SyncJobData, SyncStats } from '../types/sync.types'
import type { Ctx } from '../helpers/context.helper'
import { handleSyncStarsJob } from '../services/sync/github/githubStar.service'

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
    if (isWorker) {
      worker = new Worker<SyncJobData, SyncStats>(
        SYNC_STARS_QUEUE,
        async (job) => {
          app.log.info(`[BullMQ] Processing job ${job.id} (${job.name})`)
          if (job.name !== SYNC_STARS_JOB) {
            throw new Error(`Unknown job name: ${job.name}`)
          }

          const ctx: Ctx = { prisma: app.prisma, log: app.log, config: app.config }
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
      worker.on('completed', (job, result) => {
        app.log.info({ jobId: job.id, result }, '[BullMQ] Worker completed job')
      })
      worker.on('failed', (job, err) => {
        app.log.error({ jobId: job?.id, err }, '[BullMQ] Worker failed job')
      })
    } else {
      app.log.info(`[BullMQ] bullRole=${app.config.bullRole}; worker not started`)
    }

    // 等待就绪，确保连接可用
    await Promise.all([
      syncStarsQueue.waitUntilReady(),
      syncStarsEvents.waitUntilReady(),
      ...(worker ? [worker.waitUntilReady()] : []),
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

    // 装饰 fastify 实例，方便在 Controller/Service 使用
    app.decorate('queues', {
      syncStars: syncStarsQueue,
    })
    if (worker) {
      app.decorate('workers', { syncStars: worker })
    }

    app.addHook('onClose', async () => {
      if (worker) await worker.close()
      await syncStarsEvents.close()
      await syncStarsQueue.close()
    })
  },
  { name: 'bullmq', dependencies: ['redis', 'config'] }
)
