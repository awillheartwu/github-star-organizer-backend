// src/helpers/context.ts
import { FastifyRequest, FastifyBaseLogger } from 'fastify'
import { PrismaClient } from '@prisma/client'
export type Ctx = { prisma: PrismaClient; log: FastifyBaseLogger }
export function getCtx(req: FastifyRequest): Ctx {
  return { prisma: req.server.prisma, log: req.log }
}
