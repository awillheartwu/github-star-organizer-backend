// test/unit/plugins/auth.plugin.test.ts
import Fastify from 'fastify'
import configPlugin from '../../../src/plugins/config'
import authPlugin from '../../../src/plugins/auth'
import { TestDatabase } from '../../helpers/database.helper'

describe('auth plugin', () => {
  const redisStub = {
    get: jest.fn(async () => null),
    set: jest.fn(async () => 'OK'),
    del: jest.fn(async () => 1),
    quit: jest.fn(async () => 'OK'),
  }

  let app: ReturnType<typeof Fastify>

  beforeAll(async () => {
    await TestDatabase.setup()
  })

  afterAll(async () => {
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    const prisma = TestDatabase.getInstance()
    app = Fastify({ logger: false })
    await app.register(configPlugin)
    // inject prisma and redis
    app.decorate('prisma', prisma)
    app.decorate('redis', redisStub)
    await app.register(authPlugin)

    // utility route to sign access token
    app.post('/__sign', async (req, reply) => {
      const body = req.body || {}
      const token = await reply.accessSign(body)
      return { token }
    })
    // protected route
    app.get('/__echo', { onRequest: [app.verifyAccess] }, async () => ({ ok: true }))
    // route to set refresh cookie
    app.get('/__set_cookie', async (_req, reply) => {
      app.setRefreshCookie(reply, 'REFRESH_VALUE')
      return { ok: true }
    })
    // route to clear cookie
    app.get('/__clear_cookie', async (_req, reply) => {
      app.clearRefreshCookie(reply)
      return { ok: true }
    })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    jest.clearAllMocks()
  })

  it('verifyAccess should pass with matching tokenVersion', async () => {
    const prisma = TestDatabase.getInstance()
    const user = await prisma.user.create({
      data: { email: 'p1@example.com', passwordHash: 'h', tokenVersion: 0 },
    })
    const { payload } = await app.inject({
      method: 'POST',
      url: '/__sign',
      payload: { sub: user.id, role: 'USER', type: 'access', ver: 0 },
    })
    const token = JSON.parse(payload).token

    const res = await app.inject({
      method: 'GET',
      url: '/__echo',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('verifyAccess should fail when tokenVersion mismatches', async () => {
    const prisma = TestDatabase.getInstance()
    const user = await prisma.user.create({
      data: { email: 'p2@example.com', passwordHash: 'h', tokenVersion: 1 },
    })
    const { payload } = await app.inject({
      method: 'POST',
      url: '/__sign',
      payload: { sub: user.id, role: 'USER', type: 'access', ver: 0 },
    })
    const token = JSON.parse(payload).token

    const res = await app.inject({
      method: 'GET',
      url: '/__echo',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(401)
  })

  it('setRefreshCookie and clearRefreshCookie set correct headers', async () => {
    const set = await app.inject({ method: 'GET', url: '/__set_cookie' })
    expect(set.statusCode).toBe(200)
    const setCookie = set.headers['set-cookie'] as string | string[] | undefined
    const header = Array.isArray(setCookie) ? setCookie[0] : setCookie
    expect(header).toBeTruthy()
    expect(header).toContain('rt=') // cookie name from env
    expect(header).toContain('HttpOnly')
    expect(header).toContain('Path=/')
    expect(header).toMatch(/SameSite=Lax/i)

    const cleared = await app.inject({ method: 'GET', url: '/__clear_cookie' })
    const clearHeader = cleared.headers['set-cookie'] as string | string[] | undefined
    const ch = Array.isArray(clearHeader) ? clearHeader[0] : clearHeader
    expect(ch).toBeTruthy()
    expect(ch).toContain('rt=')
    // Max-Age=0 or Expires in the past
    expect(/Max-Age=0|Expires=/i.test(ch!)).toBe(true)
  })
})
