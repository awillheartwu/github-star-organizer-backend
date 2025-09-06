import assert from 'node:assert/strict'

/**
 * 将简单分页查询参数解析为统一分页结构。
 * - page 最小为 1
 * - pageSize 限制在 [1,100]
 * @category Helper
 */
export function getPagination(query: { page?: number; pageSize?: number }) {
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.max(1, Math.min(100, Number(query.pageSize) || 10))
  const offset = (page - 1) * pageSize
  const limit = pageSize
  assert.ok(limit > 0, 'limit must be greater than 0')
  assert.ok(offset >= 0, 'offset must be non-negative')
  return {
    page,
    pageSize,
    offset,
    limit,
  }
}
