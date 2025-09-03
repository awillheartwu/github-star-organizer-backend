// src/controllers/admin.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify'
import { getCtx } from '../helpers/context.helper'
import * as userService from '../services/user.service'
import * as adminService from '../services/admin.service'

export async function setRole(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { userId, role } = req.body as { userId: string; role: 'USER' | 'ADMIN' }
  await userService.setUserRole(ctx, userId, role)
  return reply.send({ message: 'role updated' })
}

export async function enqueueSyncStars(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const body = (req.body || {}) as Parameters<typeof adminService.enqueueSyncStarsService>[2]
  const jobId = await adminService.enqueueSyncStarsService(ctx, req.server.queues.syncStars, body)
  return reply.send({ message: 'enqueued', jobId })
}

export async function getSyncStateAdmin(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const summary = await adminService.getSyncStateSummaryService(ctx)
  return reply.send(summary)
}
