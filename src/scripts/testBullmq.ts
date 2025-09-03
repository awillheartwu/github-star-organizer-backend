import Fastify from 'fastify'
import configPlugin from '../plugins/config'
import redisPlugin from '../plugins/redis'
import bullmqPlugin from '../plugins/bullmq'
import { QueueEvents } from 'bullmq'
import { SYNC_STARS_JOB, SYNC_STARS_QUEUE } from '../constants/queueNames'

async function main() {
  const app = Fastify({ logger: { level: 'info' } })

  // 仅注册 BullMQ 所需的基础插件
  await app.register(configPlugin)
  await app.register(redisPlugin)
  await app.register(bullmqPlugin)

  await app.ready()
  app.log.info('BullMQ test bootstrap ready')

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
  const job = await app.queues.syncStars.add(
    SYNC_STARS_JOB,
    { options: { mode: 'incremental' }, actor: 'manual', note: 'bullmq quick test' },
    { removeOnComplete: true }
  )
  app.log.info({ id: job.id, name: job.name }, 'Enqueued test job')

  try {
    const result = await job.waitUntilFinished(events, 30_000)
    app.log.info({ result }, 'Job completed')
  } catch (err) {
    app.log.error({ err }, 'Job failed or timed out')
  } finally {
    await events.close()
    await app.close()
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
