// src/controllers/admin.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify'
import { getCtx } from '../helpers/context.helper'
import * as userService from '../services/user.service'
import * as adminService from '../services/admin.service'
import { getPagination } from '../helpers/pagination.helper'

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

export async function listArchivedProjects(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { offset, limit } = getPagination(req.query)
  const query = req.query as { page?: number; pageSize?: number; reason?: 'manual' | 'unstarred' }
  const result = await adminService.listArchivedProjectsService(ctx, { ...query, offset, limit })
  return reply.send({ message: 'ok', ...result })
}

export async function getArchivedProjectById(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { id } = req.params as { id: string }
  const row = await adminService.getArchivedProjectByIdService(ctx, id)
  return reply.send({ message: 'ok', data: row })
}
