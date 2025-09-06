import type { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify'
import type { AppConfig } from '../../../src/config'
import * as authController from '../../../src/controllers/auth.controller'
import * as authService from '../../../src/services/auth.service'
import { AppError } from '../../../src/helpers/error.helper'

function makeServer(
  overrides: Partial<FastifyInstance> = {},
  cfgOverrides: Partial<AppConfig> = {}
): FastifyInstance {
  const config = {
    authAllowRegistration: true,
    authCookieName: 'rt',
  } as unknown as AppConfig
  Object.assign(config, cfgOverrides)

  const server = {
    config,
    setRefreshCookie: jest.fn(),
    clearRefreshCookie: jest.fn(),
    prisma: {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    },
  } as unknown as FastifyInstance
  Object.assign(server, overrides)
  return server
}

function makeReply() {
  const record: { statusCode?: number; payload?: unknown } = {}
  const reply: Partial<FastifyReply> = {
    code: function (this: FastifyReply, c: number) {
      record.statusCode = c
      return this
    } as unknown as FastifyReply['code'],
    status: function (this: FastifyReply, c: number) {
      record.statusCode = c
      return this
    } as unknown as FastifyReply['status'],
    send: function (this: FastifyReply, p: unknown) {
      record.payload = p
      return this
    } as unknown as FastifyReply['send'],
    accessSign: jest.fn(async () => 'at'),
    refreshSign: jest.fn(async () => 'rt'),
  }
  return { reply: reply as FastifyReply, record }
}

function makeRequest(overrides: Partial<FastifyRequest> = {}): FastifyRequest {
  const base = {
    server: makeServer(),
    log: { debug: () => void 0 },
    cookies: {},
    user: undefined,
    headers: {},
    ip: '127.0.0.1',
    accessVerify: jest.fn(),
    refreshVerify: jest.fn(),
  }
  return Object.assign(base, overrides) as unknown as FastifyRequest
}

describe('auth.controller unit', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  test('register forbidden when registration disabled', async () => {
    const server = makeServer({}, { authAllowRegistration: false })
    const req = makeRequest({ server, body: { email: 'a@a.com', password: 'x' } as unknown })
    const { reply } = makeReply()
    await expect(authController.register(req, reply)).rejects.toBeInstanceOf(AppError)
  })

  test('login success sets refresh cookie and returns access token', async () => {
    type UserSelected = {
      id: string
      email: string
      passwordHash: string
      role: 'USER' | 'ADMIN'
      tokenVersion: number
    }
    jest.spyOn(authService, 'findUserByEmail').mockResolvedValueOnce({
      id: 'u1',
      email: 'a@a.com',
      passwordHash: 'hash',
      role: 'USER',
      tokenVersion: 0,
    } as UserSelected)
    jest.spyOn(authService, 'verifyPassword').mockResolvedValueOnce(true)
    jest.spyOn(authService, 'persistRefreshToken').mockResolvedValueOnce(undefined as never)

    const server = makeServer()
    const req = makeRequest({ server, body: { email: 'a@a.com', password: 'x' } as unknown })
    const { reply, record } = makeReply()
    await authController.login(req, reply)

    expect((reply.accessSign as jest.Mock).mock.calls.length).toBe(1)
    expect((reply.refreshSign as jest.Mock).mock.calls.length).toBe(1)
    expect((server.setRefreshCookie as unknown as jest.Mock).mock.calls.length).toBe(1)
    expect((record.payload as { data: { accessToken: string } }).data.accessToken).toBe('at')
  })

  test('login invalid credentials yields 401', async () => {
    jest.spyOn(authService, 'findUserByEmail').mockResolvedValueOnce(null)
    const server = makeServer()
    const req = makeRequest({ server, body: { email: 'x@x.com', password: 'p' } as unknown })
    const { reply } = makeReply()
    await expect(authController.login(req, reply)).rejects.toBeInstanceOf(AppError)
  })

  test('refresh without cookie -> 401', async () => {
    const server = makeServer()
    const req = makeRequest({ server, cookies: {} })
    const { reply } = makeReply()
    await expect(authController.refresh(req, reply)).rejects.toBeInstanceOf(AppError)
  })

  test('logout clears cookie and returns 204', async () => {
    jest.spyOn(authService, 'revokeRefreshByToken').mockResolvedValueOnce(undefined as never)
    const server = makeServer()
    const req = makeRequest({ server, cookies: { rt: 'token' } })
    const { reply, record } = makeReply()
    await authController.logout(req, reply)
    expect((server.clearRefreshCookie as unknown as jest.Mock).mock.calls.length).toBe(1)
    expect(record.statusCode).toBe(204)
  })
})
