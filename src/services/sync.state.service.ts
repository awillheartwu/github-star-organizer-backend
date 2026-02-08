import type { Ctx } from '../helpers/context.helper'
import type { SyncStats } from '../types/sync.types'
import type { SyncState as PrismaSyncState } from '@prisma/client'
import { sanitizeEtag } from '../utils/etag.util'

/**
 * 持久化“同步/任务”运行状态的实体。
 *
 * - 通过 `(source, key)` 唯一定位一类任务（例如 `github:stars` + `user:xxx`）。
 * - 字段包含：增量游标 `cursor`、HTTP ETag、最近一次运行/成功/失败时间、最近错误与统计信息等。
 */
export type SyncState = PrismaSyncState

// 约定的来源与 key 生成
/** 约定的 GitHub stars 同步来源标识 */
export const SYNC_SOURCE_GITHUB_STARS = 'github:stars'
/**
 * 构造 GitHub stars 同步的状态键。
 * @param username GitHub 用户名
 * @returns 形如 `user:NAME` 的 key
 */
export function buildGithubStarsKey(username: string) {
  return `user:${username}`
}

/**
 * 读取指定来源/键的状态（不存在返回 null）。
 * @param ctx 请求上下文
 * @param source 来源（如 `github:stars`/`ai:summary`）
 * @param key 键（业务自定义）
 */
export async function getState(ctx: Ctx, source: string, key: string) {
  return ctx.prisma.syncState.findUnique({ where: { source_key: { source, key } } })
}

/**
 * 确保状态存在，不存在则创建。
 * @returns 新建或已存在的行
 */
export async function ensureState(ctx: Ctx, source: string, key: string) {
  return ctx.prisma.syncState.upsert({
    where: { source_key: { source, key } },
    update: {},
    create: { source, key },
  })
}

/**
 * 更新最近一次运行时间（在任务开始时调用）。
 */
export async function touchRun(ctx: Ctx, source: string, key: string, when = new Date()) {
  return ctx.prisma.syncState.update({
    where: { source_key: { source, key } },
    data: { lastRunAt: when },
  })
}

/**
 * 批量设置增量同步相关的游标/ETag。
 * 传入的字段值为 `undefined` 时将被忽略。
 */
export async function setCursorEtag(
  ctx: Ctx,
  source: string,
  key: string,
  data: { cursor?: string | null; etag?: string | null }
) {
  const patch: { cursor?: string | null; etag?: string | null } = {}
  if (data.cursor !== undefined) patch.cursor = data.cursor
  if (data.etag !== undefined) patch.etag = sanitizeEtag(data.etag) ?? null
  return ctx.prisma.syncState.update({ where: { source_key: { source, key } }, data: patch })
}

/**
 * 任务成功：记录完成时间，清空错误，并可选更新 cursor/etag 与统计信息。
 */
export async function markSuccess(
  ctx: Ctx,
  source: string,
  key: string,
  info: {
    cursor?: string | null
    etag?: string | null
    stats?: SyncStats | null
    finishedAt?: Date
  }
) {
  const finishedAt = info.finishedAt ?? new Date()
  const payload: Record<string, unknown> = {
    lastRunAt: finishedAt,
    lastSuccessAt: finishedAt,
    lastError: null,
    lastErrorAt: null,
  }
  if (info.cursor !== undefined) payload.cursor = info.cursor
  if (info.etag !== undefined) payload.etag = sanitizeEtag(info.etag)
  if (info.stats) {
    const json = JSON.stringify(info.stats)
    const escaped = escapeStatsJson(json)
    payload.statsJson = escaped.length > 4096 ? escaped.slice(0, 4096) : escaped
  }

  const updated = await ctx.prisma.syncState.update({
    where: { source_key: { source, key } },
    data: payload,
  })

  // 记录历史（每次运行一条）
  try {
    await ctx.prisma.syncStateHistory.create({
      data: {
        source,
        key,
        cursor: info.cursor ?? null,
        etag: info.etag ?? null,
        lastRunAt: finishedAt,
        lastSuccessAt: finishedAt,
        statsJson: payload.statsJson ? String(payload.statsJson) : null,
      },
    })
  } catch {
    // ignore history failures
  }

  return updated
}

/**
 * 任务失败：记录错误摘要与失败时间。
 * 注意：`lastRunAt` 由 `touchRun()` 在任务开始时设置，这里不重复写入。
 */
export async function markError(
  ctx: Ctx,
  source: string,
  key: string,
  error: unknown,
  when = new Date()
) {
  const msg = normalizeErrorMessage(error)
  const updated = await ctx.prisma.syncState.update({
    where: { source_key: { source, key } },
    data: { lastErrorAt: when, lastError: msg },
  })

  // 记录历史（失败也保留）
  try {
    await ctx.prisma.syncStateHistory.create({
      data: {
        source,
        key,
        lastRunAt: when,
        lastErrorAt: when,
        lastError: msg,
      },
    })
  } catch {
    // ignore history failures
  }

  return updated
}

/**
 * 统一规整未知错误对象为短消息文本，便于持久化。
 * @param err 任意错误对象
 * @param maxLen 最大保留长度
 */
export function normalizeErrorMessage(err: unknown, maxLen = 500) {
  let msg: string
  if (typeof err === 'string') {
    msg = err
  } else if (err instanceof Error && typeof err.message === 'string') {
    msg = err.message
  } else if (typeof err === 'object' && err !== null && 'message' in err) {
    const m = (err as { message?: unknown }).message
    msg = typeof m === 'string' ? m : JSON.stringify(err)
  } else {
    msg = String(err)
  }
  return msg.length > maxLen ? msg.slice(0, maxLen) : msg
}

/**
 * 转义 JSON 字符串中的双引号，便于存储。
 * @param value 原始 JSON 字符串
 * @returns 转义后的字符串
 **/
function escapeStatsJson(value: string) {
  const withoutBackslash = value.replace(/\\/g, '')
  return withoutBackslash.replace(/"/g, '\\"')
}
