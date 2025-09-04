import type { Queue } from 'bullmq'
import type { Ctx } from '../helpers/context.helper'
import type { SyncJobData, SyncStats } from '../types/sync.types'
import { AppError } from '../helpers/error.helper'
import { ERROR_TYPES, HTTP_STATUS } from '../constants/errorCodes'
import { SYNC_SOURCE_GITHUB_STARS, buildGithubStarsKey, getState } from './sync/sync.state.service'
import { createHash } from 'node:crypto'

function hashOptions(opts: SyncJobData['options']) {
  const plain = JSON.stringify({
    mode: opts.mode,
    perPage: opts.perPage ?? null,
    maxPages: opts.maxPages ?? null,
    softDeleteUnstarred: opts.softDeleteUnstarred ?? null,
  })
  return createHash('sha1').update(plain).digest('hex').slice(0, 8)
}

export async function enqueueSyncStarsService(
  ctx: Ctx,
  queue: Queue<SyncJobData, SyncStats>,
  body: SyncJobData['options'] & { note?: string }
) {
  const suffix = hashOptions(body)
  const jobId = `sync-stars:manual:${suffix}`

  // 如果同名作业还在运行/排队，返回冲突
  const existed = await queue.getJob(jobId)
  if (existed) {
    const state = await existed.getState().catch(() => 'waiting')
    if (state && !['completed', 'failed'].includes(state)) {
      throw new AppError(
        'Sync already enqueued or running',
        HTTP_STATUS.CONFLICT.statusCode,
        ERROR_TYPES.CONFLICT,
        { jobId, state }
      )
    }
  }

  const job = await queue.add(
    'sync-stars',
    {
      options: {
        mode: body.mode,
        perPage: body.perPage,
        maxPages: body.maxPages,
        softDeleteUnstarred: body.softDeleteUnstarred,
      },
      actor: 'manual',
      note: body.note,
    },
    { jobId, removeOnComplete: true }
  )
  ctx.log.info({ jobId: job.id }, '[admin] enqueue sync-stars')
  return String(job.id)
}

export async function getSyncStateSummaryService(ctx: Ctx) {
  const source = SYNC_SOURCE_GITHUB_STARS
  const key = buildGithubStarsKey(ctx.config.githubUsername)
  const state = await getState(ctx, source, key)
  if (!state) {
    throw new AppError('State not found', HTTP_STATUS.NOT_FOUND.statusCode, ERROR_TYPES.NOT_FOUND)
  }
  return {
    id: state.id,
    source: state.source,
    key: state.key,
    cursor: state.cursor ?? undefined,
    etag: state.etag ?? undefined,
    lastRunAt: state.lastRunAt?.toISOString(),
    lastSuccessAt: state.lastSuccessAt?.toISOString(),
    lastErrorAt: state.lastErrorAt?.toISOString(),
    lastError: state.lastError ?? undefined,
    statsJson: state.statsJson ?? undefined,
    updatedAt: state.updatedAt.toISOString(),
  }
}

// —— 归档只读列表 —— //
export async function listArchivedProjectsService(
  ctx: Ctx,
  query: { page?: number; pageSize?: number; reason?: 'manual' | 'unstarred' } & {
    offset: number
    limit: number
  }
) {
  const where: Record<string, unknown> = {}
  if (query.reason) where.reason = query.reason

  const [rows, total] = await Promise.all([
    ctx.prisma.archivedProject.findMany({
      skip: query.offset,
      take: query.limit,
      where,
      orderBy: { archivedAt: 'desc' },
      select: { id: true, githubId: true, reason: true, archivedAt: true, snapshot: true },
    }),
    ctx.prisma.archivedProject.count({ where }),
  ])
  return {
    data: rows,
    page: Math.floor(query.offset / Math.max(1, query.limit)) + 1,
    pageSize: query.limit,
    total,
  }
}

export async function getArchivedProjectByIdService(ctx: Ctx, id: string) {
  const row = await ctx.prisma.archivedProject.findUnique({
    where: { id },
    select: { id: true, githubId: true, reason: true, archivedAt: true, snapshot: true },
  })
  if (!row) {
    throw new AppError(
      'Archived project not found',
      HTTP_STATUS.NOT_FOUND.statusCode,
      ERROR_TYPES.NOT_FOUND,
      { id }
    )
  }
  return row
}
