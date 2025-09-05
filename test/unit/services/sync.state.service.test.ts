// test/unit/services/sync.state.service.test.ts
import { PrismaClient } from '@prisma/client'
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'
import type { SyncStats } from '../../../src/types/sync.types'

import {
  SYNC_SOURCE_GITHUB_STARS,
  buildGithubStarsKey,
  getState,
  ensureState,
  touchRun,
  setCursorEtag,
  markSuccess,
  markError,
  normalizeErrorMessage,
} from '../../../src/services/sync.state.service'

describe('sync.state.service', () => {
  let prisma: PrismaClient
  let ctx: Ctx
  const key = buildGithubStarsKey('tester')
  const source = SYNC_SOURCE_GITHUB_STARS

  beforeAll(async () => {
    prisma = await TestDatabase.setup()
    ctx = createMockContext(prisma)
  })

  afterAll(async () => {
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()
  })

  it('ensureState creates missing row and getState retrieves it', async () => {
    const none = await getState(ctx, source, key)
    expect(none).toBeNull()

    const row = await ensureState(ctx, source, key)
    expect(row.source).toBe(source)
    expect(row.key).toBe(key)

    const found = await getState(ctx, source, key)
    expect(found?.id).toBe(row.id)
  })

  it('touchRun updates lastRunAt to provided date', async () => {
    await ensureState(ctx, source, key)
    const when = new Date('2024-01-02T03:04:05Z')
    await touchRun(ctx, source, key, when)
    const row = await getState(ctx, source, key)
    expect(row?.lastRunAt?.toISOString()).toBe(when.toISOString())
  })

  it('setCursorEtag updates only provided fields (cursor & etag)', async () => {
    await ensureState(ctx, source, key)

    await setCursorEtag(ctx, source, key, { cursor: 'c1' })
    let row = await getState(ctx, source, key)
    expect(row?.cursor).toBe('c1')
    expect(row?.etag).toBeNull()

    await setCursorEtag(ctx, source, key, { etag: 'e1' })
    row = await getState(ctx, source, key)
    expect(row?.cursor).toBe('c1')
    expect(row?.etag).toBe('e1')

    await setCursorEtag(ctx, source, key, { cursor: null, etag: null })
    row = await getState(ctx, source, key)
    expect(row?.cursor).toBeNull()
    expect(row?.etag).toBeNull()
  })

  it('markSuccess updates success times, clears error, truncates statsJson', async () => {
    await ensureState(ctx, source, key)
    const finishedAt = new Date('2024-02-03T04:05:06Z')
    const hugeStats: SyncStats = {
      pages: 9999,
      scanned: 123456,
      created: 1,
      updated: 2,
      unchanged: 3,
      softDeleted: 0,
      rateLimitRemaining: 42,
      startedAt: '2024-02-03T04:00:00Z',
      finishedAt: '2024-02-03T04:05:06Z',
      durationMs: 306000,
    }
    const res = await markSuccess(ctx, source, key, {
      cursor: 'cursorX',
      etag: 'etagX',
      stats: hugeStats,
      finishedAt,
    })
    expect(res.cursor).toBe('cursorX')
    expect(res.etag).toBe('etagX')
    expect(res.lastRunAt?.toISOString()).toBe(finishedAt.toISOString())
    expect(res.lastSuccessAt?.toISOString()).toBe(finishedAt.toISOString())
    expect(res.lastError).toBeNull()
    expect(res.lastErrorAt).toBeNull()
    expect(res.statsJson).toBeDefined()
    expect(res.statsJson!.length).toBeLessThanOrEqual(4096)
  })

  it('markError stores normalized error message & timestamp', async () => {
    await ensureState(ctx, source, key)
    const when = new Date('2024-02-04T05:06:07Z')
    await markError(ctx, source, key, new Error('boom'), when)
    let row = await getState(ctx, source, key)
    expect(row?.lastError).toBe('boom')
    expect(row?.lastErrorAt?.toISOString()).toBe(when.toISOString())

    await markError(ctx, source, key, 'too long ' + 'x'.repeat(600))
    row = await getState(ctx, source, key)
    expect(row?.lastError).toBe(normalizeErrorMessage('too long ' + 'x'.repeat(600)))

    await markError(ctx, source, key, { message: 'objMsg' })
    row = await getState(ctx, source, key)
    expect(row?.lastError).toBe('objMsg')
  })
})
