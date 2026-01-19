import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'
import { createTestUser, getAuthToken } from '../helpers/auth.helper'

describe('E2E Admin Archived Projects & Sync State', () => {
  let app: FastifyInstance
  let adminAT: string

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
    const admin = await createTestUser('archadmin@example.com', 'pwd123456', 'ADMIN', app)
    adminAT = await getAuthToken(app, admin)
  })

  it('lists archived projects and gets detail', async () => {
    // Seed archived projects
    const rows = await app.prisma.archivedProject.createMany({
      data: [
        {
          githubId: 71001,
          reason: 'manual',
          archivedAt: new Date('2023-01-01T00:00:00Z'),
          snapshot: '{"a":1}',
        },
        {
          githubId: 71002,
          reason: 'unstarred',
          archivedAt: new Date('2023-01-02T00:00:00Z'),
          snapshot: '{"b":2}',
        },
        {
          githubId: 71003,
          reason: 'manual',
          archivedAt: new Date('2023-01-03T00:00:00Z'),
          snapshot: '{"c":3}',
        },
      ],
    })
    expect(rows.count).toBe(3)

    const list = await app.inject({
      method: 'GET',
      url: '/admin/archived-projects?reason=manual&page=1&pageSize=2',
      headers: { authorization: `Bearer ${adminAT}` },
    })
    expect(list.statusCode).toBe(200)
    const body = JSON.parse(list.payload) as {
      data: Array<{ id: string; githubId: number }>
      total: number
    }
    expect(body.total).toBe(2)
    expect(body.data.length).toBeGreaterThan(0)

    // Fetch detail of one archived project
    const oneCreated = await app.prisma.archivedProject.create({
      data: {
        githubId: 71999,
        reason: 'manual',
        archivedAt: new Date('2023-01-05T00:00:00Z'),
        snapshot: '{"detail":true}',
      },
    })
    const detail = await app.inject({
      method: 'GET',
      url: `/admin/archived-projects/${oneCreated.id}`,
      headers: { authorization: `Bearer ${adminAT}` },
    })
    expect(detail.statusCode).toBe(200)
    const d = JSON.parse(detail.payload)
    expect(d.data.githubId).toBe(71999)
  })

  it('returns sync state summary when present', async () => {
    // The admin service uses config.githubUsername; .env.test sets it to 'dummy'.
    await app.prisma.syncState.create({
      data: {
        source: 'github:stars',
        key: 'user:dummy',
        cursor: 'cur',
        etag: 'tag',
        lastRunAt: new Date('2024-01-01T00:00:00Z'),
        lastSuccessAt: new Date('2024-01-01T00:10:00Z'),
        statsJson:
          '{\\"scanned\\":1,\\"created\\":1,\\"updated\\":0,\\"unchanged\\":0,\\"softDeleted\\":0,\\"pages\\":1}',
      },
    })
    const res = await app.inject({
      method: 'GET',
      url: '/admin/sync-state',
      headers: { authorization: `Bearer ${adminAT}` },
    })
    expect(res.statusCode).toBe(200)
    const payload = JSON.parse(res.payload)
    expect(payload.source).toBe('github:stars')
    expect(payload.key).toBe('user:dummy')
  })
})
