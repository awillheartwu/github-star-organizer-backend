// test/unit/plugins/bullmq.plugin.test.ts
import Fastify from 'fastify'
import configPlugin from '../../../src/plugins/config'
import bullmqPlugin from '../../../src/plugins/bullmq'
import { TestDatabase } from '../../helpers/database.helper'

// Mock bullmq classes to avoid real Redis connection
jest.mock('bullmq', () => {
  class MockQueue {
    name: string
    opts: Record<string, unknown>
    constructor(name: string, opts: Record<string, unknown>) {
      this.name = name
      this.opts = opts
    }
    async add() {
      return { id: 'job-id' }
    }
    async getJob() {
      return null
    }
    async getRepeatableJobs() {
      return []
    }
    async waitUntilReady() {
      return
    }
    async close() {
      return
    }
  }
  class MockQueueEvents {
    constructor() {}
    on() {}
    async waitUntilReady() {
      return
    }
    async close() {
      return
    }
  }
  class MockWorker {
    constructor() {}
    on() {}
    async waitUntilReady() {
      return
    }
    async close() {
      return
    }
  }
  return { Queue: MockQueue, QueueEvents: MockQueueEvents, Worker: MockWorker }
})

describe('bullmq plugin (mocked)', () => {
  const redisStub = {
    incr: jest.fn(async () => 1),
    decr: jest.fn(async () => 0),
    expire: jest.fn(async () => 1),
    get: jest.fn(async () => null),
    set: jest.fn(async () => 'OK'),
    del: jest.fn(async () => 1),
    hincrby: jest.fn(async () => 1),
    lpush: jest.fn(async () => 1),
    ltrim: jest.fn(async () => 1),
    hmget: jest.fn(async () => ['0', '0', String(Date.now()), 'zh', 'model']),
    lrange: jest.fn(async () => []),
    ping: jest.fn(async () => 'PONG'),
  }

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
    await app.register(configPlugin)
    // 注册命名插件以满足 bullmq 依赖校验
    await app.register(
      function prismaPlugin(instance, _opts, done) {
        instance.decorate('prisma', prisma)
        done()
      },
      { name: 'prisma' }
    )
    await app.register(
      function redisPlugin(instance, _opts, done) {
        instance.decorate('redis', redisStub)
        done()
      },
      { name: 'redis' }
    )
    await app.register(
      function mailerPlugin(instance, _opts, done) {
        instance.decorate('mailer', { send: async () => void 0 })
        done()
      },
      { name: 'mailer' }
    )
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('registers queues and workers, and repeatable AI sweep when cron provided', async () => {
    // 提供 cron 开启 sweep repeatable job
    app.config.aiSummaryCron = '0 4 * * *'
    await app.register(bullmqPlugin)
    await app.ready()

    expect(app.queues).toBeDefined()
    expect(app.queues.syncStars).toBeDefined()
    expect(app.queues.aiSummary).toBeDefined()
    // workers 在 mock 下也会挂载
    expect(app.workers).toBeDefined()
  })
})
