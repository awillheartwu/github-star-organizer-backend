import { FastifyInstance } from 'fastify'
import { buildTestApp, cleanupTestApp } from '../helpers/app.helper'
import { TestDatabase } from '../helpers/database.helper'

describe('E2E Change Password', () => {
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

  it('change password invalidates old login and allows new login', async () => {
    const email = 'cp@example.com'
    const oldPwd = 'oldpwd123'
    const newPwd = 'newpwd123'

    // register
    const reg = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email, password: oldPwd },
    })
    expect(reg.statusCode).toBe(201)

    // login
    const login = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: oldPwd },
    })
    expect(login.statusCode).toBe(200)
    const access = (JSON.parse(login.payload) as { data: { accessToken: string } }).data.accessToken

    // change password
    const ch = await app.inject({
      method: 'POST',
      url: '/auth/change-password',
      headers: { authorization: `Bearer ${access}` },
      payload: { oldPassword: oldPwd, newPassword: newPwd },
    })
    expect(ch.statusCode).toBe(200)

    // old login fails
    const oldLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: oldPwd },
    })
    expect(oldLogin.statusCode).toBe(401)

    // new login succeeds
    const newLogin = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: newPwd },
    })
    expect(newLogin.statusCode).toBe(200)
  })
})
