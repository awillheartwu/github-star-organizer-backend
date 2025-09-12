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
  const body = req.body as {
    limit?: number
    lang?: 'zh' | 'en'
    model?: string
    force?: boolean
    staleDaysOverride?: number
  }
  const jobId = 'ai-sweep:manual'
  const existed = await req.server.queues.aiSummary.getJob(jobId)
  if (!existed) {
    await req.server.queues.aiSummary.add(AI_SWEEP_JOB, body ?? {}, { jobId })
  }
  // 结果由 worker 返回统计；这里简单确认入列
  return reply.send({ message: 'ok', enqueued: 1, total: 0 })
}

// List AI batches from SyncState (source='ai:summary', key startsWith 'batch:')
export async function listAiBatches(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { offset, limit, page, pageSize } = getPagination(
    req.query as { page?: number; pageSize?: number }
  )
  const [rows, total] = await Promise.all([
    ctx.prisma.syncState.findMany({
      where: { source: 'ai:summary', key: { startsWith: 'batch:' } },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
      select: { key: true, lastRunAt: true, lastSuccessAt: true, statsJson: true, updatedAt: true },
    }),
    ctx.prisma.syncState.count({ where: { source: 'ai:summary', key: { startsWith: 'batch:' } } }),
  ])
  const data = rows.map((r) => ({
    key: r.key,
    lastRunAt: r.lastRunAt?.toISOString(),
    lastSuccessAt: r.lastSuccessAt?.toISOString(),
    statsJson: r.statsJson ?? undefined,
    updatedAt: r.updatedAt.toISOString(),
  }))
  return reply.send({ message: 'ok', data, page, pageSize, total })
}

export async function getAiBatchById(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { id } = req.params as { id: string }
  const key = id.startsWith('batch:') ? id : `batch:${id}`
  const r = await ctx.prisma.syncState.findFirst({
    where: { source: 'ai:summary', key },
    select: { key: true, lastRunAt: true, lastSuccessAt: true, statsJson: true, updatedAt: true },
  })
  if (!r) return reply.code(404).send({ message: 'not found' })
  return reply.send({
    message: 'ok',
    data: {
      key: r.key,
      lastRunAt: r.lastRunAt?.toISOString(),
      lastSuccessAt: r.lastSuccessAt?.toISOString(),
      statsJson: r.statsJson ?? undefined,
      updatedAt: r.updatedAt.toISOString(),
    },
  })
}

export async function getQueuesStatus(req: FastifyRequest, reply: FastifyReply) {
  type QueueCounts = {
    waiting: number
    active: number
    delayed: number
    completed: number
    failed: number
  }
  type QueueLike = { getJobCounts: (...args: string[]) => Promise<Partial<QueueCounts>> }
  const getCounts = async (q: QueueLike): Promise<QueueCounts> => {
    try {
      const c = await q.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed')
      return {
        waiting: Number(c.waiting || 0),
        active: Number(c.active || 0),
        delayed: Number(c.delayed || 0),
        completed: Number(c.completed || 0),
        failed: Number(c.failed || 0),
      }
    } catch {
      return { waiting: 0, active: 0, delayed: 0, completed: 0, failed: 0 }
    }
  }
  const queues = {
    syncStars: await getCounts(req.server.queues.syncStars),
    aiSummary: await getCounts(req.server.queues.aiSummary),
    maintenance: await getCounts(req.server.queues.maintenance),
  }
  const config = {
    aiSummaryConcurrency: req.server.config.aiSummaryConcurrency,
    aiRpmLimit: req.server.config.aiRpmLimit,
    syncConcurrency: req.server.config.syncConcurrency,
  }
  return reply.send({ message: 'ok', queues, config })
}

export async function runMaintenanceNow(req: FastifyRequest, reply: FastifyReply) {
  const job = await req.server.queues.maintenance.add(
    'maintenance',
    { actor: 'manual' },
    { jobId: `maintenance:manual:${Date.now()}`, removeOnComplete: true }
  )
  return reply.send({ message: 'ok', jobId: String(job.id) })
}
