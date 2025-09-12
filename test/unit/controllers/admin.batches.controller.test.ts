// test/unit/controllers/admin.batches.controller.test.ts
import Fastify from 'fastify'
import { TestDatabase } from '../../helpers/database.helper'
// import { getCtx } from '../../../src/helpers/context.helper'
import * as adminController from '../../../src/controllers/admin.controller'

describe('admin controller — AI batches', () => {
  const redisStub = { ping: jest.fn(async () => 'PONG') }
  let app: ReturnType<typeof Fastify>

  beforeAll(async () => {
    await TestDatabase.setup()
  })
  afterAll(async () => {
    await TestDatabase.cleanup()
  })
  beforeEach(async () => {
    const prisma = TestDatabase.getInstance()
    app = Fastify({ logger: false })
    ;(
      app as unknown as typeof app & {
        prisma: import('@prisma/client').PrismaClient
        redis: typeof redisStub
        config: Record<string, unknown>
      }
    ).prisma = prisma
    ;(app as unknown as typeof app & { redis: typeof redisStub }).redis = redisStub
    ;(app as unknown as typeof app & { config: Record<string, unknown> }).config = {
      aiSummaryConcurrency: 1,
      aiRpmLimit: 0,
      syncConcurrency: 1,
    }

    // mount minimal routes to test controller handlers directly
    app.get('/admin/ai/batches', async (req, reply) => adminController.listAiBatches(req, reply))
    app.get('/admin/ai/batches/:id', async (req, reply) =>
      adminController.getAiBatchById(req, reply)
    )
  })
  afterEach(async () => {
    await TestDatabase.clearAll()
    await app.close()
  })

  it('lists batches with pagination', async () => {
    const prisma = TestDatabase.getInstance()
    // create 3 batches
    for (let i = 0; i < 3; i++) {
      await prisma.syncState.create({
        data: {
          source: 'ai:summary',
          key: `batch:${i}`,
          lastRunAt: new Date('2023-01-01T00:00:00Z'),
          lastSuccessAt: new Date('2023-01-01T00:00:10Z'),
          statsJson: '{"ok":1}',
        },
      })
    }
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/admin/ai/batches?page=1&pageSize=2' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data.length).toBe(2)
    expect(body.total).toBe(3)
  })

  it('gets batch detail by id', async () => {
    const prisma = TestDatabase.getInstance()
    await prisma.syncState.create({
      data: {
        source: 'ai:summary',
        key: 'batch:abc',
        lastRunAt: new Date('2023-01-01T00:00:00Z'),
        lastSuccessAt: new Date('2023-01-01T00:01:00Z'),
        statsJson: '{"ok":20}',
      },
    })
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/admin/ai/batches/abc' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data.key).toBe('batch:abc')
    expect(body.data.statsJson).toBe('{"ok":20}')
  })

  it('returns 404 when batch not found', async () => {
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/admin/ai/batches/not-exist' })
    expect(res.statusCode).toBe(404)
  })
})
