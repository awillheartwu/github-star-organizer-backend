import type { Ctx } from '../../helpers/context.helper'
import type { SyncJobData, SyncStats } from '../../types/sync.types'
import { createOctokit, iterateStarred, type GitHubStarredItem } from '../github/github.client'
import { archiveAndDeleteProjectById } from '../project.service'
import {
  SYNC_SOURCE_GITHUB_STARS,
  buildGithubStarsKey,
  ensureState,
  getState,
  markError,
  markSuccess,
  touchRun,
} from '../sync.state.service'
/** @internal 将 GitHub starred 项映射为 Project 的数据结构 */
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
/** @internal 比较需要更新的字段，返回差异补丁（无差异则为空对象） */
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
/**
 * 处理 GitHub 星标同步任务：支持全量(full)与增量(incremental)两种模式。
 *
 * 流程概述：
 * 1. 读取/初始化 SyncState（cursor/etag）并标记开始
 * 2. 增量模式先做 1 条轻量预检（命中 304 则快速返回）
 * 3. 迭代抓取 stars（ETag + cursor 控制提前停止）
 * 4. 每条记录 upsert：不存在则创建，存在做字段差异比对（仅必要字段更新）
 * 5. 全量模式且遍历到末尾时，可选软删除（实际实现为归档+删除）未再出现的项目
 * 6. 汇总统计并更新 SyncState（cursor=最新 starred_at；etag=首页 ETag）
 *
 * 速率限制：若遇 secondary rate limit(403) 抛错交由队列重试；记录剩余配额。
 * 幂等性：通过 githubId 唯一约束避免重复创建；增量以 cursor/etag 截断。
 *
 * @param ctx 上下文
 * @param data BullMQ 任务数据（包含同步选项）
 * @returns 同步统计信息
 * @throws 任意底层错误（会被 BullMQ 捕获进行重试/告警）
 * @category GitHub
 */
export async function handleSyncStarsJob(ctx: Ctx, data: SyncJobData): Promise<SyncStats> {
  const startedAt = new Date()
  const { options } = data
  const perPage = options.perPage ?? ctx.config.syncPerPage ?? 50
  const maxPages = options.maxPages ?? ctx.config.syncMaxPages ?? 0
  // 模式：full | incremental
  const isFull = options.mode === 'full'
  // 软删：full 默认开启（除非显式关闭）；incremental 按配置
  let softDeleteUnstarred =
    options.softDeleteUnstarred ?? ctx.config.syncSoftDeleteUnstarred ?? false
  if (options.softDeleteUnstarred === undefined && isFull) {
    softDeleteUnstarred = true
  }
  const source = SYNC_SOURCE_GITHUB_STARS
  const key = buildGithubStarsKey(ctx.config.githubUsername)
  // 确保有一条 SyncState，并标记开始
  await ensureState(ctx, source, key)
  await touchRun(ctx, source, key, startedAt)
  const state = await getState(ctx, source, key)
  const prevEtag = state?.etag ?? undefined
  const prevCursor = state?.cursor ?? undefined
  // full 忽略 etag/cursor；incremental 使用
  const etagForFetch = isFull ? undefined : prevEtag
  const cursorForStop = isFull ? undefined : prevCursor
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
  // 增量模式：先做 1 条的轻量预检，若 304 直接返回
  if (!isFull && prevEtag) {
    try {
      const headModule = await import('../github/github.client')
      const head = await headModule.fetchFirstStarPage(octokit, {
        username: ctx.config.githubUsername,
        etag: prevEtag,
      })
      if (head.notModified) {
        const finishedAt = new Date()
        const stats: SyncStats = {
          scanned: 0,
          created: 0,
          updated: 0,
          unchanged: 0,
          softDeleted: 0,
          pages: 0,
          rateLimitRemaining: head.rateLimitRemaining,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime(),
        }
        ctx.log.info(
          { prevEtag, newEtag: head.etag ?? prevEtag, stats },
          '[sync] precheck not modified — fast exit'
        )
        await markSuccess(ctx, source, key, { etag: head.etag ?? prevEtag, stats, finishedAt })
        return stats
      }
      // 记录预检得到的最新 etag/cursor（便于观察）
      firstPageEtag = head.etag ?? prevEtag
      const top = head.items?.[0]
      if (top?.starred_at) firstPageTopCursor = top.starred_at
      ctx.log.debug(
        { precheckEtag: firstPageEtag, precheckTopCursor: firstPageTopCursor },
        '[sync] precheck result'
      )
    } catch (e) {
      ctx.log.warn({ e }, '[sync] precheck failed, continue normal iteration')
    }
  }
  try {
    for await (const res of iterateStarred(octokit, {
      username: ctx.config.githubUsername,
      perPage,
      maxPages,
      etag: etagForFetch,
      abortOnNotModified: true,
    })) {
      pages += 1
      ctx.log.debug({ page: pages, items: res.items.length }, '[sync] page fetched')
      if (pages === 1) {
        // 如果前面做过预检，就不再处理“首页 304 快速返回”的逻辑（预检已覆盖）
        if (res.notModified && isFull === false && !firstPageEtag /* no precheck result */) {
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
        // 预检已经拿到 firstPageEtag/TopCursor 的情况下，这里就不重复覆盖和打印
        if (!firstPageEtag) firstPageEtag = res.etag ?? prevEtag
        if (!firstPageTopCursor) {
          const firstItem = res.items?.[0]
          if (firstItem?.starred_at) firstPageTopCursor = firstItem.starred_at
          ctx.log.debug({ firstPageEtag, firstPageTopCursor }, '[sync] first page meta captured')
        }
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
        if (cursorForStop && item.starred_at) {
          const itemWhen = new Date(item.starred_at)
          const prevWhen = new Date(cursorForStop)
          if (itemWhen <= prevWhen) {
            stoppedByCursor = true
            ctx.log.info(
              { prevCursor: cursorForStop, hitAt: item.starred_at },
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
    // 仅在真正遍历到尾页（非游标提前停止）时进行软删除（改为：归档后删除）
    if (softDeleteUnstarred && (maxPages === 0 || reachedEnd) && !stoppedByCursor) {
      // 找到“本轮未出现”的活跃项目
      const toArchive = await ctx.prisma.project.findMany({
        where: seenIds.length > 0 ? { githubId: { notIn: seenIds } } : {},
        select: { id: true },
      })
      for (const p of toArchive) {
        try {
          await archiveAndDeleteProjectById(ctx, p.id, 'unstarred')
          softDeleted += 1
        } catch (e) {
          // 单条失败不中断同步，记录日志
          ctx.log.warn({ e, id: p.id }, '[sync] archive-and-delete failed')
        }
      }
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
