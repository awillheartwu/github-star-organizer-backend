import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'
import { createTestUser, getAuthToken } from '../helpers/auth.helper'

describe('E2E Project Basic Flow (ADMIN)', () => {
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
    const admin = await createTestUser('padmin@example.com', 'pwd123456', 'ADMIN', app)
    adminAT = await getAuthToken(app, admin)
  })

  it('create -> list(filter) -> get by id', async () => {
    const payload = {
      githubId: 91011,
      name: 'proj-e2e',
      fullName: 'user/proj-e2e',
      url: 'https://github.com/user/proj-e2e',
      description: 'e2e project',
      language: 'TypeScript',
      stars: 5,
      forks: 1,
      tags: [{ name: 'ts' }],
      videoLinks: ['https://youtu.be/xyz'],
    }
    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${adminAT}` },
      payload,
    })
    expect(createRes.statusCode).toBe(201)
    const created = JSON.parse(createRes.payload).data as { id: string }
    expect(created.id).toBeDefined()

    // list with filter
    const list = await app.inject({
      method: 'GET',
      url: '/projects?language=TypeScript&page=1&pageSize=10',
      headers: { authorization: `Bearer ${adminAT}` },
    })
    expect(list.statusCode).toBe(200)
    const l = JSON.parse(list.payload) as { data: Array<{ id: string }> }
    expect(l.data.some((p) => p.id === created.id)).toBe(true)

    // get by id
    const one = await app.inject({
      method: 'GET',
      url: `/projects/${created.id}`,
      headers: { authorization: `Bearer ${adminAT}` },
    })
    expect(one.statusCode).toBe(200)
    const o = JSON.parse(one.payload)
    expect(o.data.name).toBe('proj-e2e')
  })

  it('update tags and videoLinks works idempotently', async () => {
    // create a project first
    const createRes = await app.inject({
      method: 'POST',
      url: '/projects',
      headers: { authorization: `Bearer ${adminAT}` },
      payload: {
        githubId: 999001,
        name: 'p-update',
        fullName: 'u/p-update',
        url: 'https://github.com/u/p-update',
        videoLinks: ['https://youtu.be/a', 'https://youtu.be/b'],
      },
    })
    const created = JSON.parse(createRes.payload).data as { id: string }

    // update: keep b, add c; tags: add t1,t2
    const put = await app.inject({
      method: 'PUT',
      url: `/projects/${created.id}`,
      headers: { authorization: `Bearer ${adminAT}` },
      payload: {
        videoLinks: ['https://youtu.be/b', 'https://youtu.be/c'],
        tags: [{ name: 't1' }, { name: 't2' }],
      },
    })
    expect(put.statusCode).toBe(200)
    const updated = JSON.parse(put.payload).data as {
      videoLinks: string[]
      tags: Array<{ name: string }>
    }
    expect(updated.videoLinks.sort()).toEqual(['https://youtu.be/b', 'https://youtu.be/c'].sort())
    expect(updated.tags.map((t) => t.name).sort()).toEqual(['t1', 't2'])

    // idempotent apply same payload
    const put2 = await app.inject({
      method: 'PUT',
      url: `/projects/${created.id}`,
      headers: { authorization: `Bearer ${adminAT}` },
      payload: {
        videoLinks: ['https://youtu.be/b', 'https://youtu.be/c'],
        tags: [{ name: 't1' }, { name: 't2' }],
      },
    })
    expect(put2.statusCode).toBe(200)
  })
})
