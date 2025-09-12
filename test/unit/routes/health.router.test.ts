// test/unit/routes/health.router.test.ts
import Fastify from 'fastify'
import healthRoutes from '../../../src/routes/health.router'

describe('health routes', () => {
  it('healthz returns ok', async () => {
    const app = Fastify({ logger: false })
    // minimal decorations to satisfy types (not used by /healthz)
    app.decorate('prisma', {})
    app.decorate('redis', {})
    app.decorate('queues', {
      syncStars: { waitUntilReady: async () => {} },
      aiSummary: { waitUntilReady: async () => {} },
    })
    await app.register(healthRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/healthz' })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.payload)).toEqual({ status: 'ok' })
    await app.close()
  })

  it('readyz returns ok when deps ok', async () => {
    const app = Fastify({ logger: false })
    app.decorate('prisma', { $queryRaw: async () => 1 })
    app.decorate('redis', { ping: async () => 'PONG' })
    app.decorate('queues', {
      syncStars: { waitUntilReady: async () => {} },
      aiSummary: { waitUntilReady: async () => {} },
    })
    await app.register(healthRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/readyz' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('ok')
    expect(body.db && body.redis && body.queues).toBe(true)
    await app.close()
  })

  it('readyz returns 503 when any dep fails', async () => {
    const app = Fastify({ logger: false })
    app.decorate('prisma', {
      $queryRaw: async () => {
        throw new Error('db fail')
      },
    })
    app.decorate('redis', { ping: async () => 'PONG' })
    app.decorate('queues', {
      syncStars: { waitUntilReady: async () => {} },
      aiSummary: { waitUntilReady: async () => {} },
    })
    await app.register(healthRoutes)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/readyz' })
    expect(res.statusCode).toBe(503)
    const body = JSON.parse(res.payload)
    expect(body.status).toBe('fail')
    expect(body.db).toBe(false)
    await app.close()
  })
})
