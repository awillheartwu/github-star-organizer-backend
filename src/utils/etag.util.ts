/**
 * 移除 ETag 两端的引号，并保留是否为弱 ETag（W/ 前缀）。
 * @param etag 原始 ETag 字符串
 * @returns 清洗后的 ETag；无效输入返回 null；未提供返回 undefined
 */
export function sanitizeEtag(etag?: string | null): string | null | undefined {
  if (etag === undefined) return undefined
  if (etag === null) return null
  const trimmed = etag.trim()
  if (!trimmed) return null

  const weakPrefix = trimmed.startsWith('W/') ? 'W/' : ''
  const remainder = weakPrefix ? trimmed.slice(2) : trimmed

  const unquoted =
    remainder.startsWith('"') && remainder.endsWith('"') && remainder.length >= 2
      ? remainder.slice(1, -1)
      : remainder

  const cleaned = unquoted.trim()
  if (!cleaned) return null
  return `${weakPrefix}${cleaned}`
}

/**
 * 将存储的 ETag 转换为 `If-None-Match` 头部所需格式（带引号）。
 * @param etag 清洗后的 ETag 或原始 ETag
 */
export function formatEtagForIfNoneMatch(etag?: string | null): string | undefined {
  const sanitized = sanitizeEtag(etag)
  if (!sanitized) return undefined
  const weakPrefix = sanitized.startsWith('W/') ? 'W/' : ''
  const remainder = weakPrefix ? sanitized.slice(2) : sanitized
  if (!remainder) return undefined
  return `${weakPrefix}"${remainder}"`
}
