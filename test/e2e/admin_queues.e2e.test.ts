import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'
import { createTestUser, getAuthToken } from '../helpers/auth.helper'

describe('E2E Admin Queues & Maintenance', () => {
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
    const admin = await createTestUser('qadmin@example.com', 'pwd123456', 'ADMIN', app)
    adminAT = await getAuthToken(app, admin)
  })

  it('enqueue sync-stars returns jobId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/admin/sync-stars',
      headers: { authorization: `Bearer ${adminAT}` },
      payload: { mode: 'incremental', perPage: 10 },
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.payload)
    expect(body.jobId).toBeTruthy()
  })

  it('enqueue AI summary and sweep work with stub queues', async () => {
    // prepare a project id to enqueue (not strictly required by controller)
    const p = await app.prisma.project.create({
      data: { githubId: 33001, name: 'q1', fullName: 'u/q1', url: 'https://github.com/u/q1' },
    })
    const enq = await app.inject({
      method: 'POST',
      url: '/admin/ai/summary/enqueue',
      headers: { authorization: `Bearer ${adminAT}` },
      payload: { projectIds: [p.id], options: { lang: 'zh' } },
    })
    expect(enq.statusCode).toBe(200)
    const body1 = JSON.parse(enq.payload)
    expect(body1.enqueued).toBe(1)

    const sweep = await app.inject({
      method: 'POST',
      url: '/admin/ai/summary/sweep',
      headers: { authorization: `Bearer ${adminAT}` },
      payload: { lang: 'zh', model: 'm' },
    })
    expect(sweep.statusCode).toBe(200)
    const body2 = JSON.parse(sweep.payload)
    expect(body2.enqueued).toBe(1)
  })

  it('queues status and maintenance run', async () => {
    const status = await app.inject({
      method: 'GET',
      url: '/admin/queues',
      headers: { authorization: `Bearer ${adminAT}` },
    })
    expect(status.statusCode).toBe(200)
    const body = JSON.parse(status.payload)
    expect(body.queues).toBeDefined()
    expect(body.config).toBeDefined()

    const run = await app.inject({
      method: 'POST',
      url: '/admin/maintenance/run',
      headers: { authorization: `Bearer ${adminAT}` },
    })
    expect(run.statusCode).toBe(200)
    const rbody = JSON.parse(run.payload)
    expect(rbody.jobId).toBeTruthy()
  })

  it('bull board UI guarded by ADMIN', async () => {
    // admin can access HTML
    const ui = await app.inject({
      method: 'GET',
      url: '/admin/queues/ui',
      headers: { authorization: `Bearer ${adminAT}` },
    })
    expect([200, 302]).toContain(ui.statusCode) // bull-board may redirect to base path

    // normal user forbidden
    const user = await createTestUser('quser@example.com', 'pwd123456', 'USER', app)
    const userAT = await getAuthToken(app, user)
    const forbid = await app.inject({
      method: 'GET',
      url: '/admin/queues/ui',
      headers: { authorization: `Bearer ${userAT}` },
    })
    expect(forbid.statusCode).toBe(403)
  })
})
