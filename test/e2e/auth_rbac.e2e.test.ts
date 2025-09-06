import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'
import { createTestUser, getAuthToken } from '../helpers/auth.helper'

describe('E2E Auth & RBAC Smoke', () => {
  let app: FastifyInstance

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
  })

  it('register -> login -> me -> refresh -> logout flow works', async () => {
    // register
    const email = 'e2e1@example.com'
    const password = 'pwd123456'
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password },
    })
    expect(reg.statusCode).toBe(201)

    // login -> accessToken & refresh cookie
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password },
    })
    expect(login.statusCode).toBe(200)
    const body = JSON.parse(login.payload) as { data: { accessToken: string } }
    expect(typeof body.data.accessToken).toBe('string')
    const rtCookie = login.cookies.find((c) => c.name === 'rt')
    expect(rtCookie?.value).toBeTruthy()

    // me with bearer token
    const me = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: { authorization: `Bearer ${body.data.accessToken}` },
    })
    expect(me.statusCode).toBe(200)

    // refresh with cookie
    const refresh = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: `rt=${rtCookie!.value}` },
    })
    expect(refresh.statusCode).toBe(200)
    const body2 = JSON.parse(refresh.payload) as { data: { accessToken: string } }
    expect(typeof body2.data.accessToken).toBe('string')

    // logout then refresh should be 401
    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { authorization: `Bearer ${body2.data.accessToken}` },
    })
    expect(logout.statusCode).toBe(204)
    const refreshFail = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: { cookie: `rt=${rtCookie!.value}` },
    })
    expect(refreshFail.statusCode).toBe(401)
  })

  it('RBAC: user forbidden on admin route; admin allowed', async () => {
    // create normal user
    const user = await createTestUser('u1@example.com', 'pwd123456', 'USER', app)
    const userAT = await getAuthToken(app, user)

    // user hits admin route -> 403
    const forbidden = await app.inject({
      method: 'GET',
      url: '/admin/sync-state',
      headers: { authorization: `Bearer ${userAT}` },
    })
    expect(forbidden.statusCode).toBe(403)

    // create admin and set role of user to ADMIN via admin endpoint
    const admin = await createTestUser('admin1@example.com', 'pwd123456', 'ADMIN', app)
    const adminAT = await getAuthToken(app, admin)
    const setRole = await app.inject({
      method: 'POST',
      url: '/admin/set-role',
      headers: { authorization: `Bearer ${adminAT}` },
      payload: { userId: user.id, role: 'ADMIN' },
    })
    expect(setRole.statusCode).toBe(200)

    // user token is invalidated by tokenVersion bump; re-login to get fresh AT with ADMIN role
    const freshAT = await getAuthToken(app, user)
    // user now should pass RBAC (即使资源不存在也应非403/401)
    const maybe404 = await app.inject({
      method: 'GET',
      url: '/admin/sync-state',
      headers: { authorization: `Bearer ${freshAT}` },
    })
    expect([200, 404]).toContain(maybe404.statusCode)
  })
})
