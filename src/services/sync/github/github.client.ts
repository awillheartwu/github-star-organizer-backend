import { Octokit } from '@octokit/rest'
import { RequestError } from '@octokit/request-error'

// GitHub Star API 返回的元素（在 accept: star+json 下包含 starred_at）
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
  if (etag) headers['If-None-Match'] = etag

  try {
    const res = await octokit.request('GET /users/{username}/starred', {
      username,
      per_page: size,
      page,
      headers,
      request: { signal },
    })

    const remaining = Number(res.headers['x-ratelimit-remaining'] || '0')
    const reset = Number(res.headers['x-ratelimit-reset'] || '0')
    const nextEtag = res.headers['etag']

    return {
      items: res.data as unknown as GitHubStarredItem[],
      etag: typeof nextEtag === 'string' ? nextEtag : undefined,
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
      const nextEtag = err.response?.headers?.['etag']
      return {
        items: [],
        etag: typeof nextEtag === 'string' ? nextEtag : etag,
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
        etag,
        rateLimitRemaining: Number.isFinite(remaining) ? remaining : undefined,
        rateLimitReset: Number.isFinite(reset) ? reset : undefined,
        notModified: false,
        status: 403,
        secondaryRateLimited: true,
        retryAfterSec: Number.isFinite(retryAfter) ? retryAfter : undefined,
      }
    }
    throw err
  }
}

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
  let firstPageEtag = etag
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
