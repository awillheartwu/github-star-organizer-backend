// src/controllers/admin.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify'
import { getCtx } from '../helpers/context.helper'
import * as userService from '../services/user.service'
import * as adminService from '../services/admin.service'
import { getPagination } from '../helpers/pagination.helper'
import { AI_SUMMARY_JOB, AI_SWEEP_JOB } from '../constants/queueNames'

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

export async function enqueueAiSummary(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const body = req.body as { projectIds: string[]; options?: Record<string, unknown> }
  let enqueued = 0
  for (const id of body.projectIds || []) {
    const jobId = `ai-summary:${id}:${body.options?.lang ?? '-'}:${body.options?.model ?? '-'}`
    const existed = await req.server.queues.aiSummary.getJob(jobId)
    if (existed) {
      const state = await existed.getState().catch(() => 'unknown')
      const runningStates = new Set(['waiting', 'active', 'delayed', 'paused', 'waiting-children'])
      if (!runningStates.has(state)) {
        try {
          await existed.remove()
        } catch {
          // ignore remove error
        }
      } else {
        continue
      }
    }
    await req.server.queues.aiSummary.add(
      AI_SUMMARY_JOB,
      { projectId: id, options: body.options },
      { jobId }
    )
    enqueued += 1
  }
  ctx.log.info({ enqueued }, '[admin] enqueue ai summary')
  return reply.send({ message: 'ok', enqueued })
}

export async function enqueueAiSweep(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as { limit?: number; lang?: 'zh' | 'en'; model?: string }
  const jobId = 'ai-sweep:manual'
  const existed = await req.server.queues.aiSummary.getJob(jobId)
  if (!existed) {
    await req.server.queues.aiSummary.add(AI_SWEEP_JOB, body ?? {}, { jobId })
  }
  // 结果由 worker 返回统计；这里简单确认入列
  return reply.send({ message: 'ok', enqueued: 1, total: 0 })
}
