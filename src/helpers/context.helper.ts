// src/helpers/context.ts
import { FastifyRequest, FastifyBaseLogger } from 'fastify'
import { PrismaClient } from '@prisma/client'
import type { AppConfig } from '../config'
import type { Redis } from 'ioredis'

/**
 * 请求级依赖注入上下文，封装常用资源：`prisma` / `log` / `config` / `redis`。
 * @category Helper
 */
export type Ctx = { prisma: PrismaClient; log: FastifyBaseLogger; config: AppConfig; redis: Redis }

/**
 * 从 Fastify Request 构建 `Ctx` 对象，便于在 service 层解耦框架细节。
 * @category Helper
 */
export function getCtx(req: FastifyRequest): Ctx {
  return {
    prisma: req.server.prisma,
    log: req.log,
    config: req.server.config,
    redis: req.server.redis,
  }
}
