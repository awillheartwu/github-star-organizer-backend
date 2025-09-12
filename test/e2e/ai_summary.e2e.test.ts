import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'
import { createTestUser, getAuthToken } from '../helpers/auth.helper'

// Mock provider to avoid network
jest.mock('../../src/services/ai.client', () => ({
  generateWithProvider: jest.fn(async () => ({
    content: JSON.stringify({ short: 'S', long: 'L', tags: ['ai', 'summary'] }),
    model: 'ai:mock',
  })),
}))

describe('E2E AI Summary (ADMIN)', () => {
  let app: FastifyInstance
  let userAT: string

  beforeAll(async () => {
    await TestDatabase.setup()
    app = await buildTestApp()
    await app.ready()
  })

  afterAll(async () => {
    await cleanupTestApp(app)
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()
    const user = await createTestUser('au@example.com', 'pwd123456', 'USER', app)
    userAT = await getAuthToken(app, user)
  })

  it('generate summary for a project and attach tags (admin only)', async () => {
    // prepare a project via admin
    const admin = await createTestUser('admin-ai@example.com', 'pwd123456', 'ADMIN', app)
    const adminAT = await getAuthToken(app, admin)
    const create = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${adminAT}` },
      payload: {
        githubId: 60001,
        name: 'ai-target',
        fullName: 'user/ai-target',
        url: 'https://github.com/user/ai-target',
      },
    })
    const projId = (JSON.parse(create.payload).data as { id: string }).id

    const res = await app.inject({
      method: 'POST',
      url: `/ai/projects/${projId}/summary`,
      // ADMIN is required to trigger AI summary
      headers: { authorization: `Bearer ${adminAT}` },
      payload: { style: 'both', lang: 'zh' },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.data.summaryShort).toBe('S')
    expect(body.data.summaryLong).toBe('L')
  })

  it('forbids normal user to trigger summary', async () => {
    const admin = await createTestUser('admin-ai-2@example.com', 'pwd123456', 'ADMIN', app)
    const adminAT = await getAuthToken(app, admin)
    const create = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${adminAT}` },
      payload: {
        githubId: 60002,
        name: 'ai-target-2',
        fullName: 'user/ai-target-2',
        url: 'https://github.com/user/ai-target-2',
      },
    })
    const projId = (JSON.parse(create.payload).data as { id: string }).id

    const res = await app.inject({
      method: 'POST',
      url: `/ai/projects/${projId}/summary`,
      headers: { authorization: `Bearer ${userAT}` },
      payload: { style: 'both', lang: 'zh' },
    })
    expect(res.statusCode).toBe(403)
  })
})
