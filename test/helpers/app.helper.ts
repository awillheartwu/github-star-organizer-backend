// test/helpers/app.helper.ts
import Fastify, { FastifyInstance } from 'fastify'
import configPlugin from '../../src/plugins/config'
import authPlugin from '../../src/plugins/auth'
import { handleServerError } from '../../src/helpers/error.helper'
import authRoutes from '../../src/routes/auth.router'
import projectRoutes from '../../src/routes/project.router'
import tagRoutes from '../../src/routes/tag.router'
import adminRoutes from '../../src/routes/admin.router'
import aiRoutes from '../../src/routes/ai.router'
import { TestDatabase } from './database.helper'
import type { Redis } from 'ioredis'

// 轻量 Redis stub，避免集成测试连接真实 Redis
const redisStub = {
  async get(_key: string): Promise<string | null> {
    console.log('Redis GET called with key:', _key)
    return null
  },
  async set(_key: string, _value: string, ..._args: unknown[]): Promise<string> {
    console.log('Redis SET called with key:', _key, 'value:', _value, ..._args)
    return 'OK'
  },
  async del(..._keys: string[]): Promise<number> {
    console.log('Redis DEL called with keys:', _keys)
    return 1
  },
  async quit(): Promise<string> {
    return 'OK'
  },
} as unknown as Redis

export async function buildTestApp(): Promise<FastifyInstance> {
  process.env.NODE_ENV = 'test'

  // 由 TestDatabase 提供已连接的 PrismaClient（指向测试库）
  const prisma = await TestDatabase.setup()

  const app = Fastify({ logger: false })
  // 注册统一错误处理，保证 E2E 返回与生产一致的结构/状态码
  app.setErrorHandler((err, _req, reply) => handleServerError(reply, err))

  // 装配必须插件（顺序：config → 自定义注入 prisma/redis → auth → 路由）
  await app.register(configPlugin)

  // 注入测试用 prisma 与 redis（类型对齐到 FastifyInstance 声明合并）
  app.decorate('prisma', prisma)
  app.decorate('redis', redisStub)

  // 轻量队列 stub，避免依赖 BullMQ/Redis
  type JobStub = { id: string; getState: () => Promise<string>; remove: () => Promise<void> }
  type QueueStub = {
    add: (name: string, data?: unknown, opts?: { jobId?: string }) => Promise<{ id: string }>
    getJob: (id: string) => Promise<JobStub | null>
    getJobCounts: (..._args: string[]) => Promise<{
      waiting: number
      active: number
      delayed: number
      completed: number
      failed: number
    }>
    waitUntilReady?: () => Promise<void>
  }
  const makeQueueStub = (qname: string): QueueStub => {
    return {
      async add(_name: string, _data?: unknown, opts?: { jobId?: string }) {
        return { id: opts?.jobId || `${qname}:job:${Date.now()}` }
      },
      async getJob(_id: string) {
        void _id
        // 简化：默认不存在，便于测试覆盖入列路径
        return null
      },
      async getJobCounts() {
        return { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 }
      },
      async waitUntilReady() {
        return
      },
    }
  }
  const queues = {
    syncStars: makeQueueStub('sync-stars'),
    maintenance: makeQueueStub('maintenance'),
    aiSummary: makeQueueStub('ai-summary'),
  }
  app.decorate('queues', queues)

  // 鉴权与 cookie/jwt
  await app.register(authPlugin)

  // 注册路由：auth、project、tag、admin、ai（E2E 冒烟需要）
  await app.register(authRoutes)
  await app.register(projectRoutes)
  await app.register(tagRoutes)
  await app.register(adminRoutes)
  await app.register(aiRoutes)

  await app.ready()
  return app
}

export async function cleanupTestApp(app: FastifyInstance): Promise<void> {
  await app.close()
}
