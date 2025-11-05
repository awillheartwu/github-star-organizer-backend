import type { Queue } from 'bullmq'
import type { Ctx } from '../helpers/context.helper'
import type { SyncJobData, SyncStats } from '../types/sync.types'
import { AppError } from '../helpers/error.helper'
import { ERROR_TYPES, HTTP_STATUS } from '../constants/errorCodes'
import { SYNC_SOURCE_GITHUB_STARS, buildGithubStarsKey, getState } from './sync.state.service'
import { createHash } from 'node:crypto'
import { sanitizeEtag } from '../utils/etag.util'

/** @internal 为手动同步参数生成短哈希（用于构建幂等 jobId） */
/**
 * 为手动同步参数生成短哈希（用于构建幂等 jobId）
 * @param opts 同步选项（mode/perPage/maxPages/softDeleteUnstarred）
 * @returns 8 位十六进制前缀（sha1）
 */
function hashOptions(opts: SyncJobData['options']) {
  const plain = JSON.stringify({
    mode: opts.mode,
    perPage: opts.perPage ?? null,
    maxPages: opts.maxPages ?? null,
    softDeleteUnstarred: opts.softDeleteUnstarred ?? null,
  })
  return createHash('sha1').update(plain).digest('hex').slice(0, 8)
}

/**
 * 将手动 GitHub Stars 同步任务加入队列：
 * - 根据参数生成幂等 jobId，如果已有未完成任务则冲突
 * - 任务附带可选 note，用于审计/追踪
 *
 * @param ctx 上下文
 * @param queue BullMQ 队列实例
 * @param body 同步选项（mode/perPage/maxPages/softDeleteUnstarred + note）
 * @returns jobId 字符串
 * @throws {AppError} 已有同参数进行中的任务 (409)
 * @category Admin
 */
/**
 * 手动入列 GitHub Stars 同步任务。
 *
 * - 根据参数生成幂等 jobId，若已有未完成任务则报 409。
 * - 任务附带可选 note 以便审计。
 *
 * @throws AppError(CONFLICT) 当同参数任务仍在进行中
 * @returns 新创建的 BullMQ jobId
 */
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
    let state: string | undefined
    try {
      state = await existed.getState()
    } catch {
      // 无法读取状态时，保守当作仍在队列中
      state = 'waiting'
    }
    if (state && !['completed', 'failed'].includes(state)) {
      throw new AppError(
        'Sync already enqueued or running',
        HTTP_STATUS.CONFLICT.statusCode,
        ERROR_TYPES.CONFLICT,
        { jobId, state }
      )
    }
  }

  const job = await (async () => {
    try {
      return await queue.add(
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
    } catch (e) {
      throw new AppError(
        'Failed to enqueue sync job',
        HTTP_STATUS.BAD_GATEWAY.statusCode,
        ERROR_TYPES.EXTERNAL_SERVICE,
        { jobId, cause: (e as Error)?.message }
      )
    }
  })()
  ctx.log.info({ jobId: job.id }, '[admin] enqueue sync-stars')
  return String(job.id)
}

/**
 * 获取 GitHub Stars 同步状态摘要（最近运行信息、错误、统计等）。
 * @throws {AppError} 状态不存在 (404)
 * @category Admin
 */
/**
 * 获取 GitHub Stars 同步的状态摘要。
 * - 读取 SyncState（source='github:stars'，key='user:USERNAME'）
 * - 规范化时间字段为 ISO 字符串，便于展示
 *
 * @throws AppError(NOT_FOUND) 当状态不存在
 */
export async function getSyncStateSummaryService(ctx: Ctx) {
  const source = SYNC_SOURCE_GITHUB_STARS
  const key = buildGithubStarsKey(ctx.config.githubUsername)
  const state = await getState(ctx, source, key)
  if (!state) {
    throw new AppError('State not found', HTTP_STATUS.NOT_FOUND.statusCode, ERROR_TYPES.NOT_FOUND)
  }
  const { statsJson, latestStats } = normalizeStatsJson(ctx, state?.statsJson)

  return {
    id: state.id,
    source: state.source,
    key: state.key,
    cursor: state.cursor ?? undefined,
    etag: sanitizeEtag(state.etag) ?? undefined,
    lastRunAt: state.lastRunAt?.toISOString(),
    lastSuccessAt: state.lastSuccessAt?.toISOString(),
    lastErrorAt: state.lastErrorAt?.toISOString(),
    lastError: state.lastError ?? undefined,
    statsJson,
    latestStats: latestStats ?? undefined,
    updatedAt: state.updatedAt.toISOString(),
  }
}

function normalizeStatsJson(
  ctx: Ctx,
  raw: string | null | undefined
): { statsJson: string | undefined; latestStats: SyncStats | undefined } {
  if (!raw) {
    return {
      statsJson: undefined,
      latestStats: undefined,
    }
  }
  try {
    const parsed = JSON.parse(removeAllBackslashes(raw)) as SyncStats
    const escaped = sanitizeJsonString(JSON.stringify(parsed))
    return {
      statsJson: escaped,
      latestStats: parsed,
    }
  } catch (error) {
    ctx.log.warn({ err: error }, '[admin] failed to parse statsJson, returning raw value')
    return {
      statsJson: sanitizeJsonString(raw),
      latestStats: undefined,
    }
  }
}

function removeAllBackslashes(value: string) {
  return value.replace(/\\/g, '')
}

function sanitizeJsonString(value: string) {
  const withoutBackslash = removeAllBackslashes(value)
  return withoutBackslash.replace(/"/g, '\\"')
}

// —— 归档只读列表 —— //
/**
 * 分页列出已归档项目（来源：手动删除或同步检测 unstarred）。
 * @param ctx 上下文
 * @param query 分页与过滤（reason、offset、limit）
 * @returns 分页结果（data/page/pageSize/total）
 * @category Admin
 */
/**
 * 分页列出归档项目（只读）。
 * @param query 支持 reason 过滤与 offset/limit 分页
 * @returns { data, page, pageSize, total }
 */
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

/**
 * 获取归档项目快照详情。
 * @throws {AppError} 未找到 (404)
 * @category Admin
 */
/**
 * 获取归档项目快照详情。
 * @throws AppError(NOT_FOUND) 未找到
 */
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
