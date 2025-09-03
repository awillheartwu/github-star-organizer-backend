import Fastify from 'fastify'
import configPlugin from '../plugins/config'
import redisPlugin from '../plugins/redis'
import bullmqPlugin from '../plugins/bullmq'
import { QueueEvents } from 'bullmq'
import { SYNC_STARS_JOB, SYNC_STARS_QUEUE } from '../constants/queueNames'
import crypto from 'node:crypto'

async function main() {
  const app = Fastify({ logger: { level: 'info' } })

  // 仅注册 BullMQ 所需的基础插件
  await app.register(configPlugin)
  await app.register(redisPlugin)
  await app.register(bullmqPlugin)

  await app.ready()
  app.log.info('BullMQ test bootstrap ready')

  // 打印运行角色与已注册 repeatable 任务
  app.log.info({ bullRole: app.config.bullRole }, 'Bull role from config')
  try {
    const repeatables = await app.queues.syncStars.getRepeatableJobs()
    app.log.info({ count: repeatables.length, repeatables }, 'Registered repeatable jobs')
  } catch (e) {
    app.log.warn({ e }, 'Failed to fetch repeatable jobs')
  }

  // 为等待完成创建一个临时 QueueEvents（与插件中的事件隔离）
  const events = new QueueEvents(SYNC_STARS_QUEUE, {
    connection: {
      host: app.config.redisHost,
      port: app.config.redisPort,
      password: app.config.redisPassword,
      maxRetriesPerRequest: null as unknown as number | null,
      enableReadyCheck: true,
    },
    prefix: app.config.bullPrefix,
  })
  await events.waitUntilReady()

  // 入队一个测试任务
  // 生成基于 options 的手动 jobId（与 admin.service 保持一致的序列化规则）
  const opts = { mode: 'incremental' as const }
  const optsHash = crypto
    .createHash('sha1')
    .update(
      JSON.stringify({ mode: opts.mode, perPage: null, maxPages: null, softDeleteUnstarred: null })
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
    const result = await job.waitUntilFinished(events, 30_000)
    app.log.info({ result }, 'Job completed')
  } catch (err) {
    app.log.error({ err }, 'Job failed or timed out')
  } finally {
    // 追加：构造一个失败用例（使用未知的 job name 触发 worker 抛错 → 失败邮件）
    try {
      const failJob = await app.queues.syncStars.add(
        'sync-stars-invalid',
        { options: opts, actor: 'manual', note: 'force a fail for mail test' },
        { removeOnComplete: true, removeOnFail: true, jobId: `${manualJobId}:fail` }
      )
      try {
        await failJob.waitUntilFinished(events, 10_000)
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

    await events.close()
    await app.close()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
