import { Octokit } from '@octokit/rest'
import { RequestError } from '@octokit/request-error'
import type { Ctx } from '../../helpers/context.helper'
import { formatEtagForIfNoneMatch, sanitizeEtag } from '../../utils/etag.util'
/**
 * GitHub Stars API 返回的单条记录（在 `accept: application/vnd.github.star+json` 下包含 `starred_at`）。
 * @category GitHub
 */
export interface GitHubStarredItem {
  starred_at?: string
  repo: {
    id: number
    name: string
    full_name: string
    html_url: string
    description: string | null
    language: string | null
    stargazers_count: number
    forks_count: number
    pushed_at: string | null
  }
}
/**
 * 抓取 stars 页结果封装。
 * - `notModified` 表示 ETag 命中（items 为空）
 * - 403 + `secondaryRateLimited` 表示触发二级限流，可用 `retryAfterSec` 做退避
 * @category GitHub
 */
export type FetchStarredResult = {
  items: GitHubStarredItem[]
  etag?: string
  rateLimitRemaining?: number
  rateLimitReset?: number
  notModified?: boolean
  status: number
  secondaryRateLimited?: boolean
  retryAfterSec?: number
}
/**
 * 创建 Octokit 客户端，支持可选 token 及 request 超时。
 * @param token GitHub 令牌（可选）
 * @param requestTimeoutMs 请求超时（ms）
 * @category GitHub
 */
export function createOctokit(token?: string, requestTimeoutMs?: number) {
  const octokit = new Octokit({
    auth: token,
    request: {
      // Octokit 支持 timeout，可用于软超时控制
      timeout: requestTimeoutMs,
    },
  })
  return octokit
}
/** @internal 简单获取错误 code（网络层） */
function getErrorCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const c = (err as { code?: unknown }).code
    return typeof c === 'string' ? c : undefined
  }
  return undefined
}

/**
 * 给 Octokit RequestError 附加 meta，便于上层日志 / error.helper 观察。
 * 不改变原始错误 message，仅添加可读字段。
 */
type RequestErrorWithMeta = RequestError & {
  // 追加的元数据
  meta?: {
    route?: string
    rateLimitRemaining?: number
    rateLimitReset?: number
    status?: number
  }
  // 通过索引访问原始结构（不改变 RequestError 类型定义）
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  request?: { request?: { route?: string }; url?: string }
}
function attachRequestMeta(err: RequestError) {
  try {
    const e = err as RequestErrorWithMeta
    const headers = e.response?.headers || {}
    const remaining = Number(headers['x-ratelimit-remaining'] || '0')
    const reset = Number(headers['x-ratelimit-reset'] || '0')
    const route = e.request?.request?.route || e.request?.url || undefined
    e.meta = {
      route,
      rateLimitRemaining: Number.isFinite(remaining) ? remaining : undefined,
      rateLimitReset: Number.isFinite(reset) ? reset : undefined,
      status: e.status,
    }
  } catch {
    // 忽略元数据注入失败
  }
}
/**
 * @internal 轻量指数退避重试（网络瞬时错误 & 5xx）。
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: { retries?: number; baseDelayMs?: number }
) {
  const retries = opts?.retries ?? 2
  const base = opts?.baseDelayMs ?? 500
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const isReqErr = err instanceof RequestError
      const status = isReqErr ? err.status : undefined
      const code = getErrorCode(err)
      const retryableStatus = status && status >= 500
      const retryableCode =
        code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(code)
      if (i < retries && (retryableStatus || retryableCode)) {
        await new Promise((r) => setTimeout(r, base * Math.pow(2, i)))
        continue
      }
      throw err
    }
  }
  throw lastErr
}
/**
 * 抓取指定页的 starred 仓库列表，支持 ETag 条件请求。
 * @returns 包含分页 items / 限流信息 / ETag / 状态。
 * @category GitHub
 */
export async function fetchStarredPage(
  octokit: Octokit,
  params: {
    username: string
    page?: number
    perPage?: number
    etag?: string
    signal?: AbortSignal
  }
): Promise<FetchStarredResult> {
  const { username, page = 1, perPage = 50, etag, signal } = params
  const size = Math.min(Math.max(perPage, 1), 100)
  const headers: Record<string, string> = {
    accept: 'application/vnd.github.star+json',
  }
  const ifNoneMatch = formatEtagForIfNoneMatch(etag)
  if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch
  try {
    const res = await withRetry(() =>
      octokit.request('GET /users/{username}/starred', {
        username,
        per_page: size,
        page,
        headers,
        request: { signal },
      })
    )
    const remaining = Number(res.headers['x-ratelimit-remaining'] || '0')
    const reset = Number(res.headers['x-ratelimit-reset'] || '0')
    const nextEtagHeader = res.headers['etag']
    const nextEtag = typeof nextEtagHeader === 'string' ? sanitizeEtag(nextEtagHeader) : undefined
    return {
      items: res.data as unknown as GitHubStarredItem[],
      etag: nextEtag ?? undefined,
      rateLimitRemaining: Number.isFinite(remaining) ? remaining : undefined,
      rateLimitReset: Number.isFinite(reset) ? reset : undefined,
      notModified: false,
      status: res.status,
    }
  } catch (err) {
    // 304 Not Modified（ETag 命中）
    if (err instanceof RequestError && err.status === 304) {
      const remaining = Number(err.response?.headers?.['x-ratelimit-remaining'] || '0')
      const reset = Number(err.response?.headers?.['x-ratelimit-reset'] || '0')
      const nextEtagHeader = err.response?.headers?.['etag']
      const nextEtag = typeof nextEtagHeader === 'string' ? sanitizeEtag(nextEtagHeader) : undefined
      return {
        items: [],
        etag: nextEtag ?? sanitizeEtag(etag) ?? undefined,
        rateLimitRemaining: Number.isFinite(remaining) ? remaining : undefined,
        rateLimitReset: Number.isFinite(reset) ? reset : undefined,
        notModified: true,
        status: 304,
      }
    }
    // 403 secondary rate limit
    if (err instanceof RequestError && err.status === 403) {
      const headers = err.response?.headers || {}
      const retryAfter = Number(headers['retry-after'] || '0')
      const remaining = Number(headers['x-ratelimit-remaining'] || '0')
      const reset = Number(headers['x-ratelimit-reset'] || '0')
      return {
        items: [],
        etag: sanitizeEtag(etag) ?? undefined,
        rateLimitRemaining: Number.isFinite(remaining) ? remaining : undefined,
        rateLimitReset: Number.isFinite(reset) ? reset : undefined,
        notModified: false,
        status: 403,
        secondaryRateLimited: true,
        retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : undefined,
      }
    }
    if (err instanceof RequestError) {
      attachRequestMeta(err)
    }
    throw err
  }
}
/**
 * 轻量预检：抓取第一页 1 条，用于快速命中 304 或获取最新 ETag。
 * @category GitHub
 */
export async function fetchFirstStarPage(
  octokit: Octokit,
  params: { username: string; etag?: string; signal?: AbortSignal }
): Promise<FetchStarredResult> {
  return fetchStarredPage(octokit, {
    username: params.username,
    page: 1,
    perPage: 1,
    etag: params.etag,
    signal: params.signal,
  })
}
/**
 * 迭代抓取用户所有已 star 仓库（支持 maxPages 限制 & ETag 首页条件请求）。
 * 当 `abortOnNotModified` 且命中 304 时提前结束。
 * @category GitHub
 */
export async function* iterateStarred(
  octokit: Octokit,
  params: {
    username: string
    perPage?: number
    maxPages?: number
    etag?: string
    abortOnNotModified?: boolean
    signal?: AbortSignal
  }
) {
  const { username, perPage = 50, maxPages = 0, etag, abortOnNotModified = true, signal } = params
  let page = 1
  const initialEtag = sanitizeEtag(etag)
  let firstPageEtag = initialEtag ?? undefined
  // 0 = 不限；否则最多抓取 maxPages 页
  while (maxPages === 0 || page <= maxPages) {
    const res = await fetchStarredPage(octokit, {
      username,
      page,
      perPage,
      etag: page === 1 ? firstPageEtag : undefined,
      signal,
    })
    if (res.notModified && abortOnNotModified) {
      return
    }
    if (page === 1 && res.etag) firstPageEtag = res.etag
    yield res
    if (!res.items?.length) break
    page += 1
  }
}
// ---- Repo content helpers ----
/**
 * 获取仓库 README 原始文本（fullName = owner/repo）。失败返回空字符串。
 * @category GitHub
 */
export async function getRepoReadmeRawByFullName(ctx: Ctx, fullName: string): Promise<string> {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) return ''
  const octokit = new Octokit(ctx.config.githubToken ? { auth: ctx.config.githubToken } : undefined)
  try {
    const res = await octokit.repos.getReadme({ owner, repo, mediaType: { format: 'raw' } })
    return typeof res.data === 'string' ? (res.data as unknown as string) : ''
  } catch (err) {
    if (err instanceof RequestError) {
      attachRequestMeta(err)
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          at: 'github.getReadme',
          // 保持非致命，仅观察
          level: 'warn',
          message: 'Failed to fetch README (returning empty string)',
          error: err.message,
          meta: (err as RequestErrorWithMeta).meta,
        })
      )
    }
    return ''
  }
}
