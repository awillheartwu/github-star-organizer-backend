import type { Ctx } from '../../helpers/context.helper'
import type { SyncStats } from '../../types/sync.types'
import type { SyncState as PrismaSyncState } from '@prisma/client'

export type SyncState = PrismaSyncState

// 约定的来源与 key 生成
export const SYNC_SOURCE_GITHUB_STARS = 'github:stars'
export function buildGithubStarsKey(username: string) {
  return `user:${username}`
}

export async function getState(ctx: Ctx, source: string, key: string) {
  return ctx.prisma.syncState.findUnique({ where: { source_key: { source, key } } })
}

export async function ensureState(ctx: Ctx, source: string, key: string) {
  return ctx.prisma.syncState.upsert({
    where: { source_key: { source, key } },
    update: {},
    create: { source, key },
  })
}

export async function touchRun(ctx: Ctx, source: string, key: string, when = new Date()) {
  return ctx.prisma.syncState.update({
    where: { source_key: { source, key } },
    data: { lastRunAt: when },
  })
}

export async function setCursorEtag(
  ctx: Ctx,
  source: string,
  key: string,
  data: { cursor?: string | null; etag?: string | null }
) {
  const patch: { cursor?: string | null; etag?: string | null } = {}
  if (data.cursor !== undefined) patch.cursor = data.cursor
  if (data.etag !== undefined) patch.etag = data.etag
  return ctx.prisma.syncState.update({ where: { source_key: { source, key } }, data: patch })
}

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
  const payload: Record<string, unknown> = {
    lastRunAt: info.finishedAt ?? new Date(),
    lastSuccessAt: info.finishedAt ?? new Date(),
    lastError: null,
    lastErrorAt: null,
  }
  if (info.cursor !== undefined) payload.cursor = info.cursor
  if (info.etag !== undefined) payload.etag = info.etag
  if (info.stats) {
    const json = JSON.stringify(info.stats)
    payload.statsJson = json.length > 4096 ? json.slice(0, 4096) : json
  }

  return ctx.prisma.syncState.update({ where: { source_key: { source, key } }, data: payload })
}

export async function markError(
  ctx: Ctx,
  source: string,
  key: string,
  error: unknown,
  when = new Date()
) {
  const msg = normalizeErrorMessage(error)
  return ctx.prisma.syncState.update({
    where: { source_key: { source, key } },
    // 仅标记错误；lastRunAt 由 touchRun 负责
    data: { lastErrorAt: when, lastError: msg },
  })
}

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
