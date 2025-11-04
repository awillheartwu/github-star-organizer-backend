import Fastify from 'fastify'
import configPlugin from '../plugins/config'
import redisPlugin from '../plugins/redis'
import prismaPlugin from '../plugins/prisma'
import mailerPlugin from '../plugins/mailer'
import bullmqPlugin from '../plugins/bullmq'
import { QueueEvents } from 'bullmq'
import {
  SYNC_STARS_JOB,
  SYNC_STARS_QUEUE,
  MAINTENANCE_JOB,
  MAINTENANCE_QUEUE,
} from '../constants/queueNames'
import { AI_SUMMARY_QUEUE, AI_SWEEP_JOB } from '../constants/queueNames'
import crypto from 'node:crypto'

async function main() {
  const app = Fastify({ logger: { level: 'info' } })

  // 注册 BullMQ 运行所需的基础插件（包含 Prisma 和 Mailer，供 worker 使用）
  await app.register(configPlugin)
  await app.register(redisPlugin)
  await app.register(prismaPlugin)
  await app.register(mailerPlugin)
  await app.register(bullmqPlugin)

  await app.ready()
  app.log.info('BullMQ test bootstrap ready')

  // Simple args parser: node script [sync] [maint]
  const argv = process.argv.slice(2)
  const flags = argv.map((a) => a.replace(/^--?/, ''))
  console.log('Args:', argv, 'Flags:', flags)
  const runSync = flags.length === 0 || flags.includes('sync')
  const runMaint = flags.length === 0 || flags.includes('maint')
  const runAi = flags.length === 0 || flags.includes('ai')

  // 打印运行角色与已注册 repeatable 任务
  app.log.info({ bullRole: app.config.bullRole }, 'Bull role from config')
  try {
    const repeatables = await app.queues.syncStars.getRepeatableJobs()
    app.log.info({ count: repeatables.length, repeatables }, 'Registered repeatable jobs')
  } catch (e) {
    app.log.warn({ e }, 'Failed to fetch repeatable jobs')
  }

  // 为等待完成创建临时 QueueEvents（与插件中的事件隔离）
  const syncEvents = new QueueEvents(SYNC_STARS_QUEUE, {
    connection: {
      host: app.config.redisHost,
      port: app.config.redisPort,
      password: app.config.redisPassword,
      maxRetriesPerRequest: null as unknown as number | null,
      enableReadyCheck: true,
    },
    prefix: app.config.bullPrefix,
  })
  await syncEvents.waitUntilReady()

  const maintEvents = new QueueEvents(MAINTENANCE_QUEUE, {
    connection: {
      host: app.config.redisHost,
      port: app.config.redisPort,
      password: app.config.redisPassword,
      maxRetriesPerRequest: null as unknown as number | null,
      enableReadyCheck: true,
    },
    prefix: app.config.bullPrefix,
  })
  await maintEvents.waitUntilReady()

  const aiEvents = new QueueEvents(AI_SUMMARY_QUEUE, {
    connection: {
      host: app.config.redisHost,
      port: app.config.redisPort,
      password: app.config.redisPassword,
      maxRetriesPerRequest: null as unknown as number | null,
      enableReadyCheck: true,
    },
    prefix: app.config.bullPrefix,
  })
  await aiEvents.waitUntilReady()

  // 入队一个测试任务（同步）
  if (runSync) {
    // 生成基于 options 的手动 jobId（与 admin.service 保持一致的序列化规则）
    const opts = { mode: 'incremental' as const }
    const optsHash = crypto
      .createHash('sha1')
      .update(
        JSON.stringify({
          mode: opts.mode,
          perPage: null,
          maxPages: null,
          softDeleteUnstarred: null,
        })
      )
      .digest('hex')
      .slice(0, 8)
    const manualJobId = `sync-stars:manual:${optsHash}`

    const job = await app.queues.syncStars.add(
      SYNC_STARS_JOB,
      { options: opts, actor: 'manual', note: 'bullmq quick test' },
      { removeOnComplete: true, jobId: manualJobId }
    )
    const state1 = await job.getState().catch(() => 'unknown')
    app.log.info(
      { id: job.id, name: job.name, jobId: manualJobId, state: state1 },
      'Enqueued test job'
    )

    // 再次尝试入队相同参数：BullMQ 语义为“幂等返回同一 Job”或在已完成后新建
    const dup = await app.queues.syncStars.add(
      SYNC_STARS_JOB,
      { options: opts, actor: 'manual', note: 'duplicate test' },
      { removeOnComplete: true, jobId: manualJobId }
    )
    const stateDup = await dup.getState().catch(() => 'unknown')
    if (dup.id === job.id) {
      app.log.info(
        { id: dup.id, state: stateDup },
        'Duplicate enqueue deduped to same job (expected)'
      )
    } else if (state1 === 'completed' || state1 === 'failed') {
      app.log.info(
        { firstId: job.id, secondId: dup.id, firstState: state1, secondState: stateDup },
        'First job already finished; new job created (expected)'
      )
    } else {
      app.log.warn(
        { firstId: job.id, secondId: dup.id, firstState: state1, secondState: stateDup },
        'Duplicate enqueue created a different job while first still running (check dedup logic)'
      )
    }

    try {
      const result = await job.waitUntilFinished(syncEvents, 30_000)
      app.log.info({ result }, 'Job completed')
    } catch (err) {
      app.log.error({ err }, 'Job failed or timed out')
    }

    // 失败用例
    try {
      const failJobId = `${manualJobId}-fail`
      const failJob = await app.queues.syncStars.add(
        'sync-stars-invalid',
        { options: opts, actor: 'manual', note: 'force a fail for mail test' },
        { removeOnComplete: true, removeOnFail: true, jobId: failJobId }
      )
      try {
        await failJob.waitUntilFinished(syncEvents, 10_000)
        app.log.warn({ id: failJob.id }, 'Expected failure but job completed')
      } catch (e) {
        console.log('Failure job errored as expected:', e)
        app.log.info(
          { id: failJob.id },
          'Failure job behaved as expected (should trigger fail mail)'
        )
      }
    } catch (e) {
      app.log.warn({ e }, 'Enqueue fail-case job failed')
    }
  }

  // 入队维护任务
  if (runMaint) {
    try {
      const maintJob = await app.queues.maintenance.add(
        MAINTENANCE_JOB,
        { actor: 'manual', note: 'maintenance quick test' },
        { attempts: 1, removeOnComplete: true, jobId: `maintenance:manual:${Date.now()}` }
      )
      app.log.info({ id: maintJob.id }, 'Maintenance job enqueued')

      // Periodically report job state while waiting
      const interval = setInterval(async () => {
        try {
          const state = await maintJob.getState()
          app.log.info({ id: maintJob.id, state }, 'Maintenance job state')
        } catch (e) {
          app.log.warn({ e }, 'Poll maintenance state failed')
        }
      }, 5000)

      try {
        const maintRes = await maintJob.waitUntilFinished(maintEvents, 180_000)
        app.log.info({ maintRes }, 'Maintenance job completed')
      } finally {
        clearInterval(interval)
      }
    } catch (e) {
      app.log.error({ e }, 'Maintenance job failed or timed out')
    }
  }

  // 入队 AI 全量扫描（根据配置的 staleDays 判定；用于测试批量 AI 摘要）
  if (runAi) {
    try {
      const jobSuffix = `test-${Date.now()}`
      const jobId = `ai-sweep:manual:${jobSuffix}`
      const sweep = await app.queues.aiSummary.add(
        AI_SWEEP_JOB,
        {
          limit: 800,
          lang: 'zh',
          model: app.config.aiModel || 'deepseek-chat',
          force: false,
          // staleDaysOverride: 0,
        },
        { jobId, removeOnComplete: true }
      )
      app.log.info({ id: sweep.id, jobId }, 'AI sweep job enqueued')

      // 等待 sweep 完成并打印结果（enqueued 数）
      const res = await sweep.waitUntilFinished(aiEvents, 120_000).catch((e) => {
        app.log.error({ e }, 'AI sweep failed or timed out')
        return null
      })
      if (res) app.log.info({ res }, 'AI sweep completed')
    } catch (e) {
      app.log.error({ e }, 'Enqueue AI sweep failed')
    }
  }

  await syncEvents.close()
  await maintEvents.close()
  await aiEvents.close()
  await app.close()
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
