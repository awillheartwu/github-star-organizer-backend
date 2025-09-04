import 'fastify'
import { PrismaClient } from '@prisma/client'
import { config } from '../config'
import type { Redis } from 'ioredis'
import type { Queue, Worker } from 'bullmq'
import type { SyncJobData, SyncStats } from '../types/sync.types'

type SameSiteMode = 'lax' | 'strict' | 'none'
type UserJwtPayload = {
  sub: string
  role?: 'USER' | 'ADMIN'
  type?: 'access' | 'refresh'
  ver?: number
  [k: string]: unknown
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    config: typeof config
    redis: Redis
    // BullMQ 队列与 worker
    queues: {
      syncStars: Queue<SyncJobData, SyncStats>
      maintenance?: Queue
    }
    // 在 bull 角色不是 worker 时不会注册 workers，故设为可选
    workers?: {
      syncStars: Worker<SyncJobData, SyncStats>
      maintenance?: Worker
    }

    // 鉴权：路由前置校验 Access Token
    verifyAccess: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    // RBAC：角色守卫
    roleGuard: (
      ...roles: string[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void | undefined>
    // 刷新用 httpOnly Cookie 的设置/清除
    setRefreshCookie: (reply: FastifyReply, token: string) => void
    clearRefreshCookie: (reply: FastifyReply) => void

    // 简易邮件发送器
    mailer: {
      send: (opts: {
        to: string | string[]
        subject: string
        text?: string
        html?: string
      }) => Promise<void>
    }
  }

  interface FastifyRequest {
    // 命名空间别名方法（对应 @fastify/jwt 的 namespace: 'access' / 'refresh'）
    accessVerify: (options?: unknown) => Promise<void>
    refreshVerify: (options?: unknown) => Promise<void>
  }

  interface FastifyReply {
    // 命名空间别名方法：签发 access / refresh
    accessSign: (payload: object, options?: unknown) => Promise<string>
    refreshSign: (payload: object, options?: unknown) => Promise<string>
  }
}

// ====== map JWT payload & user to your shape via @fastify/jwt ======
declare module '@fastify/jwt' {
  interface FastifyJWT {
    // JWT 负载里你会签进去的内容（签发与验证时都用这个形状）
    payload: UserJwtPayload
    // 验签通过后挂到 request.user 的形状
    user: UserJwtPayload
  }
}
