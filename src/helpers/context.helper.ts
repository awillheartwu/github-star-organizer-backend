// src/helpers/context.ts
import { FastifyRequest, FastifyBaseLogger } from 'fastify'
import { PrismaClient } from '@prisma/client'
import type { AppConfig } from '../config'

export type Ctx = { prisma: PrismaClient; log: FastifyBaseLogger; config: AppConfig }
export function getCtx(req: FastifyRequest): Ctx {
  return { prisma: req.server.prisma, log: req.log, config: req.server.config }
}
