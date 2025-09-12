import { FastifyReply, FastifyRequest } from 'fastify'

export async function healthz(_req: FastifyRequest, reply: FastifyReply) {
  return reply.send({ status: 'ok' })
}

export async function readyz(req: FastifyRequest, reply: FastifyReply) {
  let db = false
  let redis = false
  let queues = false

  try {
    await req.server.prisma.$queryRaw`SELECT 1`
    db = true
  } catch (_e) {
    db = false
  }
  try {
    await req.server.redis.ping()
    redis = true
  } catch (_e) {
    redis = false
  }
  try {
    await Promise.all([
      req.server.queues.syncStars.waitUntilReady(),
      req.server.queues.aiSummary.waitUntilReady(),
    ])
    queues = true
  } catch (_e) {
    queues = false
  }

  const ok = db && redis && queues
  return reply.code(ok ? 200 : 503).send({ status: ok ? 'ok' : 'fail', db, redis, queues })
}
