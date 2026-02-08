// src/controllers/admin.controller.ts
import { Prisma } from '@prisma/client'
import { FastifyReply, FastifyRequest } from 'fastify'
import { getCtx } from '../helpers/context.helper'
import * as userService from '../services/user.service'
import * as adminService from '../services/admin.service'
import { getPagination } from '../helpers/pagination.helper'
import { AI_SUMMARY_JOB, AI_SWEEP_JOB } from '../constants/queueNames'

type AiSummaryJobOptions = {
  style?: 'short' | 'long' | 'both'
  lang?: 'zh' | 'en'
  model?: string
  temperature?: number
  createTags?: boolean
  includeReadme?: boolean
  readmeMaxChars?: number
  overwrite?: boolean
}

function coerceAiSummaryOptions(raw?: Record<string, unknown>): AiSummaryJobOptions | undefined {
  if (!raw) return undefined
  const opts: AiSummaryJobOptions = {}
  const { style, lang, model, temperature, createTags, includeReadme, readmeMaxChars, overwrite } =
    raw

  if (style === 'short' || style === 'long' || style === 'both') opts.style = style
  if (lang === 'zh' || lang === 'en') opts.lang = lang
  if (typeof model === 'string') opts.model = model
  if (typeof temperature === 'number') opts.temperature = temperature
  if (typeof createTags === 'boolean') opts.createTags = createTags
  if (typeof includeReadme === 'boolean') opts.includeReadme = includeReadme
  if (typeof readmeMaxChars === 'number') opts.readmeMaxChars = readmeMaxChars
  if (typeof overwrite === 'boolean') opts.overwrite = overwrite

  return Object.keys(opts).length > 0 ? opts : undefined
}

const RUNNING_JOB_STATES = new Set(['waiting', 'active', 'delayed', 'paused', 'waiting-children'])

function sanitizeJobSegment(value?: string | null, fallback = 'default') {
  return (value ?? fallback).replace(/:/g, '-')
}

async function getAiSummaryQueueRemaining(req: FastifyRequest) {
  try {
    const queue = req.server.queues.aiSummary
    if (!queue) return undefined
    const counts = await queue.getJobCounts()
    const waiting = counts.waiting ?? 0
    const delayed = counts.delayed ?? 0
    const active = counts.active ?? 0
    const waitingChildren = counts.waitingChildren ?? 0
    const prioritized = counts.prioritized ?? 0
    return waiting + delayed + active + waitingChildren + prioritized
  } catch {
    return undefined
  }
}

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
  const body = req.body as {
    projectIds: string[]
    options?: Record<string, unknown>
    note?: string
  }
  const sanitizedOptions = coerceAiSummaryOptions(body.options)
  const langSegment = sanitizeJobSegment(sanitizedOptions?.lang)
  const modelSegment = sanitizeJobSegment(sanitizedOptions?.model)
  let enqueued = 0
  for (const id of body.projectIds || []) {
    const jobId = `ai-summary:${id}:${langSegment}-${modelSegment}`
    const existed = await req.server.queues.aiSummary.getJob(jobId)
    if (existed) {
      const state = await existed.getState().catch(() => 'unknown')
      if (!RUNNING_JOB_STATES.has(state)) {
        try {
          await existed.remove()
        } catch {
          // ignore remove error
        }
      } else {
        continue
      }
    }
    const jobOptions = sanitizedOptions ? { ...sanitizedOptions } : undefined
    await req.server.queues.aiSummary.add(
      AI_SUMMARY_JOB,
      { projectId: id, options: jobOptions },
      { jobId }
    )
    enqueued += 1
  }
  ctx.log.info({ enqueued }, '[admin] enqueue ai summary')
  const queueRemaining = await getAiSummaryQueueRemaining(req)
  return reply.send({ message: 'ok', enqueued, queueRemaining })
}

export async function enqueueAiSweep(req: FastifyRequest, reply: FastifyReply) {
  const body = req.body as {
    limit?: number
    lang?: 'zh' | 'en'
    model?: string
    force?: boolean
    staleDaysOverride?: number
  }
  const jobId = 'ai-sweep:manual:default'
  const existingSweepJob = await req.server.queues.aiSummary.getJob(jobId)
  if (existingSweepJob) {
    const state = await existingSweepJob.getState().catch(() => 'unknown')
    if (RUNNING_JOB_STATES.has(state)) {
      const queueRemaining = await getAiSummaryQueueRemaining(req)
      return reply.send({ message: 'ok', enqueued: 0, total: 0, queueRemaining })
    }
    try {
      await existingSweepJob.remove()
    } catch {
      // ignore remove error; we'll still try to enqueue a fresh sweep job
    }
  }
  let total = 0
  let enqueued = 0
  const defaultLimit = req.server.config.aiSummaryLimit ?? 100
  const limit = Math.max(1, Math.min(800, body?.limit ?? defaultLimit))
  const useForce = !!body?.force
  const staleDaysCfg = req.server.config.aiSummaryStaleDays ?? 365
  const staleDays = Math.max(0, body?.staleDaysOverride ?? staleDaysCfg)
  const staleBefore = new Date(Date.now() - staleDays * 24 * 3600 * 1000)

  const where = useForce
    ? { archived: false }
    : {
        archived: false,
        OR: [{ aiSummarizedAt: null }, { aiSummarizedAt: { lt: staleBefore } }],
      }
  const candidates = await req.server.prisma.project.findMany({
    where,
    select: { id: true },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  })
  total = candidates.length

  const langSegment = sanitizeJobSegment(body?.lang, 'any')
  const modelSegment = sanitizeJobSegment(body?.model)

  for (const candidate of candidates) {
    const summaryJobId = `ai-summary:${candidate.id}:${langSegment}-${modelSegment}`
    const existingSummaryJob = await req.server.queues.aiSummary.getJob(summaryJobId)
    if (existingSummaryJob) {
      const state = await existingSummaryJob.getState().catch(() => 'unknown')
      if (!RUNNING_JOB_STATES.has(state)) {
        enqueued += 1
      }
    } else {
      enqueued += 1
    }
  }

  await req.server.queues.aiSummary.add(
    AI_SWEEP_JOB,
    {
      limit,
      lang: body?.lang,
      model: body?.model,
      force: useForce,
      staleDaysOverride: body?.staleDaysOverride,
    },
    { jobId }
  )
  const queueRemaining = await getAiSummaryQueueRemaining(req)
  return reply.send({ message: 'ok', enqueued, total, queueRemaining })
}

// List AI batches from SyncState (source='ai:summary', key startsWith 'batch:')
export async function listAiBatches(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { offset, limit, page, pageSize } = getPagination(
    req.query as { page?: number; pageSize?: number }
  )
  const { sortField: rawSortField, sortOrder: rawSortOrder } = req.query as {
    sortField?: string
    sortOrder?: string
  }
  const sortOrder: Prisma.SortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc'
  const allowedFields = new Set(['createdAt', 'lastRunAt', 'lastSuccessAt', 'lastErrorAt'])
  const sortField = allowedFields.has(rawSortField ?? '') ? (rawSortField as string) : 'createdAt'
  const orderBy: Prisma.SyncStateHistoryOrderByWithRelationInput[] = [
    { [sortField]: sortOrder } as Prisma.SyncStateHistoryOrderByWithRelationInput,
  ]
  const where = {
    OR: [
      { source: 'github:stars' },
      { source: 'maintenance' },
      { source: 'ai:summary', key: { startsWith: 'batch:' } },
    ],
  }
  const [rows, total] = await Promise.all([
    ctx.prisma.syncStateHistory.findMany({
      where,
      orderBy,
      skip: offset,
      take: limit,
      select: {
        id: true,
        source: true,
        key: true,
        lastRunAt: true,
        lastSuccessAt: true,
        lastErrorAt: true,
        lastError: true,
        statsJson: true,
        createdAt: true,
      },
    }),
    ctx.prisma.syncStateHistory.count({ where }),
  ])
  const data = rows.map((r) => ({
    id: r.id,
    source: r.source,
    key: r.key,
    lastRunAt: r.lastRunAt?.toISOString(),
    lastSuccessAt: r.lastSuccessAt?.toISOString(),
    lastErrorAt: r.lastErrorAt?.toISOString(),
    lastError: r.lastError ?? undefined,
    statsJson: r.statsJson ?? undefined,
    createdAt: r.createdAt.toISOString(),
  }))
  return reply.send({ message: 'ok', data, page, pageSize, total })
}

export async function getAiBatchById(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { id } = req.params as { id: string }
  const r = await ctx.prisma.syncStateHistory.findUnique({
    where: { id },
    select: {
      id: true,
      source: true,
      key: true,
      lastRunAt: true,
      lastSuccessAt: true,
      lastErrorAt: true,
      lastError: true,
      statsJson: true,
      createdAt: true,
    },
  })
  if (!r) return reply.code(404).send({ message: 'not found' })
  return reply.send({
    message: 'ok',
    data: {
      id: r.id,
      source: r.source,
      key: r.key,
      lastRunAt: r.lastRunAt?.toISOString(),
      lastSuccessAt: r.lastSuccessAt?.toISOString(),
      lastErrorAt: r.lastErrorAt?.toISOString(),
      lastError: r.lastError ?? undefined,
      statsJson: r.statsJson ?? undefined,
      createdAt: r.createdAt.toISOString(),
    },
  })
}

export async function getQueuesStatus(req: FastifyRequest, reply: FastifyReply) {
  type QueueLike = {
    getJobCounts: (...args: string[]) => Promise<Record<string, number>>
    isPaused?: () => Promise<boolean>
  }
  const computeCounts = async (queue?: QueueLike) => {
    if (!queue) {
      return {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
        waitingChildren: 0,
        prioritized: 0,
        stalled: 0,
        total: 0,
        totalProcessed: 0,
        successRate: undefined,
        isPaused: false,
        updatedAt: new Date().toISOString(),
      }
    }
    try {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'completed',
        'failed',
        'paused',
        'waiting-children',
        'prioritized',
        'stalled'
      )
      const waiting = Number(counts.waiting || 0)
      const active = Number(counts.active || 0)
      const delayed = Number(counts.delayed || 0)
      const completed = Number(counts.completed || 0)
      const failed = Number(counts.failed || 0)
      const paused = Number(counts.paused || 0)
      const waitingChildren = Number(counts['waiting-children'] || 0)
      const prioritized = Number(counts.prioritized || 0)
      const stalled = Number(counts.stalled || 0)
      const total =
        waiting +
        active +
        delayed +
        completed +
        failed +
        paused +
        waitingChildren +
        prioritized +
        stalled
      const totalProcessed = completed + failed
      const successRate =
        totalProcessed > 0 ? Math.round((completed / totalProcessed) * 1000) / 1000 : undefined
      const isPaused =
        typeof queue.isPaused === 'function' ? await queue.isPaused().catch(() => false) : false
      return {
        waiting,
        active,
        delayed,
        completed,
        failed,
        paused,
        waitingChildren,
        prioritized,
        stalled,
        total,
        totalProcessed,
        successRate,
        isPaused,
        updatedAt: new Date().toISOString(),
      }
    } catch {
      return {
        waiting: 0,
        active: 0,
        delayed: 0,
        completed: 0,
        failed: 0,
        paused: 0,
        waitingChildren: 0,
        prioritized: 0,
        stalled: 0,
        total: 0,
        totalProcessed: 0,
        successRate: undefined,
        isPaused: false,
        updatedAt: new Date().toISOString(),
      }
    }
  }
  const queues = {
    syncStars: await computeCounts(req.server.queues.syncStars),
    aiSummary: await computeCounts(req.server.queues.aiSummary),
    maintenance: await computeCounts(req.server.queues.maintenance),
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
