import { Queue } from 'bullmq'
import configPlugin from '../plugins/config'
import Fastify from 'fastify'

function parseArgs() {
  const args = process.argv.slice(2)
  const rm = args.find((a) => a.startsWith('--rm='))?.split('=')[1]
  const recentStr = args.find((a) => a.startsWith('--recent='))?.split('=')[1]
  const recent = Math.max(1, Number(recentStr ?? '10'))
  return { rm, recent }
}

async function main() {
  const { rm, recent } = parseArgs()
  const app = Fastify({ logger: false })
  await app.register(configPlugin)
  await app.ready()
  const connection = {
    host: app.config.redisHost,
    port: app.config.redisPort,
    password: app.config.redisPassword,
    maxRetriesPerRequest: null as unknown as number | null,
    enableReadyCheck: true,
  }
  const queue = new Queue('maintenance', { connection, prefix: app.config.bullPrefix })
  await queue.waitUntilReady()

  if (rm) {
    try {
      await queue.remove(rm)
      console.log('[inspect] removed job id:', rm)
    } catch (e) {
      console.log('[inspect] remove failed for id:', rm, 'err:', e)
    }
  }

  const counts = await queue.getJobCounts()
  console.log('Job counts:', counts)

  // List latest jobs across common states (desc: newest first)
  const jobs = await queue.getJobs(
    ['completed', 'failed', 'active', 'waiting', 'delayed'],
    0,
    Math.max(0, recent - 1),
    false
  )
  for (const j of jobs) {
    const state = await j.getState().catch(() => 'err-state')
    const ts = new Date(j.timestamp || Date.now()).toISOString()
    const finishedOn = j.finishedOn ? new Date(j.finishedOn).toISOString() : '-'
    console.log(
      `id=${j.id} name=${j.name} state=${state} ts=${ts} finished=${finishedOn} reason=${j.failedReason || ''}`
    )
  }

  await queue.close()
  await app.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
