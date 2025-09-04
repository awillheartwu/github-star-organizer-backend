// src/helpers/context.ts
import { FastifyRequest, FastifyBaseLogger } from 'fastify'
import { PrismaClient } from '@prisma/client'
import type { AppConfig } from '../config'
import type { Redis } from 'ioredis'

export type Ctx = { prisma: PrismaClient; log: FastifyBaseLogger; config: AppConfig; redis: Redis }
export function getCtx(req: FastifyRequest): Ctx {
  return {
    prisma: req.server.prisma,
    log: req.log,
    config: req.server.config,
    redis: req.server.redis,
  }
}
