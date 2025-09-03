import type { Ctx } from '../../../helpers/context.helper'
import type { SyncJobData, SyncStats } from '../../../types/sync.types'
import { createOctokit, iterateStarred, type GitHubStarredItem } from './github.client'
import {
  SYNC_SOURCE_GITHUB_STARS,
  buildGithubStarsKey,
  ensureState,
  getState,
  markError,
  markSuccess,
  touchRun,
} from '../sync.state.service'

// 将 GitHub starred 项映射为 Project 的数据结构
function mapToProjectData(item: GitHubStarredItem) {
  const r = item.repo
  return {
    githubId: r.id,
    name: r.name,
    fullName: r.full_name,
    url: r.html_url,
    description: r.description,
    language: r.language,
    stars: r.stargazers_count,
    forks: r.forks_count,
    lastCommit: r.pushed_at ? new Date(r.pushed_at) : null,
    lastSyncAt: new Date(),
    touchedAt: new Date(),
  }
}

// 比较需要更新的字段，返回差异补丁（无差异则为空对象）
function diffProject(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const patch: Record<string, unknown> = {}
  const keys = [
    'name',
    'fullName',
    'url',
    'description',
    'language',
    'stars',
    'forks',
    'lastCommit',
  ] as const
  for (const k of keys) {
    const a = existing[k as keyof typeof existing]
    const b = incoming[k as keyof typeof incoming]
    // Date 比较：转毫秒
    if (a instanceof Date || b instanceof Date) {
      const at = a instanceof Date ? a.getTime() : a
      const bt = b instanceof Date ? b.getTime() : b
      if (at !== bt) patch[k] = b
    } else if (a !== b) {
      patch[k] = b
    }
  }
  return patch
}

export async function handleSyncStarsJob(ctx: Ctx, data: SyncJobData): Promise<SyncStats> {
  const startedAt = new Date()
  const { options } = data
  const perPage = options.perPage ?? ctx.config.syncPerPage ?? 50
  const maxPages = options.maxPages ?? ctx.config.syncMaxPages ?? 0
  const softDeleteUnstarred =
    options.softDeleteUnstarred ?? ctx.config.syncSoftDeleteUnstarred ?? false

  const source = SYNC_SOURCE_GITHUB_STARS
  const key = buildGithubStarsKey(ctx.config.githubUsername)

  // 确保有一条 SyncState，并标记开始
  await ensureState(ctx, source, key)
  await touchRun(ctx, source, key, startedAt)
  const state = await getState(ctx, source, key)
  const prevEtag = state?.etag ?? undefined
  const prevCursor = state?.cursor ?? undefined

  // 可视化关键上下文：模式/分页/历史游标与 ETag
  ctx.log.info(
    {
      job: 'sync-stars',
      mode: options.mode,
      perPage,
      maxPages,
      softDeleteUnstarred,
      prevEtag,
      prevCursor,
    },
    '[sync] start GitHub stars sync'
  )

  const octokit = createOctokit(ctx.config.githubToken, ctx.config.syncRequestTimeout)

  let firstPageEtag: string | undefined
  let firstPageTopCursor: string | undefined
  let pages = 0
  let scanned = 0
  let created = 0
  let updated = 0
  let unchanged = 0
  let rateLimitRemaining: number | undefined
  const seenIds: number[] = []
  let reachedEnd = false
  let stoppedByCursor = false

  try {
    for await (const res of iterateStarred(octokit, {
      username: ctx.config.githubUsername,
      perPage,
      maxPages,
      etag: prevEtag,
      abortOnNotModified: true,
    })) {
      pages += 1
      ctx.log.debug({ page: pages, items: res.items.length }, '[sync] page fetched')
      if (pages === 1) {
        if (res.notModified) {
          // 增量命中 ETag，直接成功返回
          const finishedAt = new Date()
          const stats: SyncStats = {
            scanned: 0,
            created: 0,
            updated: 0,
            unchanged: 0,
            softDeleted: 0,
            pages: 0,
            rateLimitRemaining: res.rateLimitRemaining,
            startedAt: startedAt.toISOString(),
            finishedAt: finishedAt.toISOString(),
            durationMs: finishedAt.getTime() - startedAt.getTime(),
          }
          ctx.log.info(
            { prevEtag, newEtag: res.etag ?? prevEtag, stats },
            '[sync] ETag not modified — skip'
          )
          await markSuccess(ctx, source, key, { etag: res.etag ?? prevEtag, stats, finishedAt })
          return stats
        }
        firstPageEtag = res.etag ?? prevEtag
        const firstItem = res.items?.[0]
        if (firstItem?.starred_at) firstPageTopCursor = firstItem.starred_at
        ctx.log.debug({ firstPageEtag, firstPageTopCursor }, '[sync] first page meta captured')
      }

      if (res.secondaryRateLimited) {
        // 抛错交给 BullMQ 重试（按 backoff）
        const retry = res.retryAfterSec ? ` retry-after=${res.retryAfterSec}s` : ''
        throw new Error(`GitHub secondary rate limited.${retry}`)
      }

      rateLimitRemaining = res.rateLimitRemaining ?? rateLimitRemaining
      scanned += res.items.length

      // 入库
      for (const item of res.items) {
        // 若已存在游标，遇到“旧数据”则提前停止（不再向后翻页）
        if (prevCursor && item.starred_at) {
          const itemWhen = new Date(item.starred_at)
          const prevWhen = new Date(prevCursor)
          if (itemWhen <= prevWhen) {
            stoppedByCursor = true
            ctx.log.info(
              { prevCursor, hitAt: item.starred_at },
              '[sync] cursor reached, stop scanning more pages'
            )
            break
          }
        }

        const dataMap = mapToProjectData(item)
        seenIds.push(dataMap.githubId)

        const existing = await ctx.prisma.project.findUnique({
          where: { githubId: dataMap.githubId },
          select: {
            id: true,
            name: true,
            fullName: true,
            url: true,
            description: true,
            language: true,
            stars: true,
            forks: true,
            lastCommit: true,
            lastSyncAt: true,
            archived: true,
          },
        })

        if (!existing) {
          await ctx.prisma.project.create({ data: dataMap })
          created += 1
          continue
        }

        // 若已归档，更新时可解除归档（这里选择不自动解除，保持安全；如需可设置 archived=false）
        const patch = diffProject(existing as unknown as Record<string, unknown>, dataMap)
        if (Object.keys(patch).length > 0) {
          // 仅在真实字段变更时更新 lastSyncAt；始终记录触达
          patch.lastSyncAt = new Date()
          patch.touchedAt = new Date()
          await ctx.prisma.project.update({ where: { githubId: dataMap.githubId }, data: patch })
          updated += 1
        } else {
          unchanged += 1
          // 内容未变也记录“触达时间”
          await ctx.prisma.project.update({
            where: { githubId: dataMap.githubId },
            data: { touchedAt: new Date() },
          })
        }
      }

      // 如因游标命中提前停止，跳出外层分页循环
      if (stoppedByCursor) break

      // 判断是否到达尾页（简单依据：返回数量 < perPage）
      if (res.items.length < Math.min(Math.max(perPage, 1), 100)) {
        reachedEnd = true
      }
    }

    // 可选：软删除不在本次结果中的项目（仅在全量且抓到末页时）
    let softDeleted = 0
    // 仅在真正遍历到尾页（非游标提前停止）时进行软删除
    if (
      softDeleteUnstarred &&
      (maxPages === 0 || reachedEnd) &&
      !stoppedByCursor &&
      seenIds.length > 0
    ) {
      const result = await ctx.prisma.project.updateMany({
        where: { archived: false, githubId: { notIn: seenIds } },
        data: { archived: true, deletedAt: new Date() },
      })
      softDeleted = result.count
    }

    const finishedAt = new Date()
    const stats: SyncStats = {
      scanned,
      created,
      updated,
      unchanged,
      softDeleted,
      pages,
      rateLimitRemaining,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    }
    ctx.log.info(
      {
        pages,
        scanned,
        created,
        updated,
        unchanged,
        softDeleted,
        rateLimitRemaining,
        reachedEnd,
        stoppedByCursor,
        newCursor: firstPageTopCursor ?? null,
        newEtag: firstPageEtag ?? null,
      },
      '[sync] job summary'
    )
    await markSuccess(ctx, source, key, {
      cursor: firstPageTopCursor ?? state?.cursor ?? null,
      etag: firstPageEtag ?? null,
      stats,
      finishedAt,
    })
    return stats
  } catch (err) {
    ctx.log.error({ err }, '[sync] job failed')
    await markError(ctx, source, key, err)
    throw err
  }
}
