import { handleServerError, AppError } from '../../src/helpers/error.helper'

function makeReply() {
  const rec: { status?: number; payload?: unknown } = {}
  const reply = {
    request: {
      url: '/x',
      method: 'GET',
      log: { error: () => void 0 },
    },
    status(code: number) {
      rec.status = code
      return this
    },
    send(payload: unknown) {
      rec.payload = payload
      return this
    },
  } as unknown as Parameters<typeof handleServerError>[0]
  return { reply, rec }
}

describe('handleServerError', () => {
  test('handles AppError', () => {
    const { reply, rec } = makeReply()
    handleServerError(reply, new AppError('boom', 418, 'Teapot'))
    expect(rec.status).toBe(418)
    expect(rec.payload).toMatchObject({ message: 'boom', code: 418, errorType: 'Teapot' })
  })

  test('handles validation-like error object', () => {
    const { reply, rec } = makeReply()
    handleServerError(reply, { validation: [{ field: 'a' }], message: 'bad' })
    expect(rec.status).toBe(400)
    expect(rec.payload).toMatchObject({ errorType: 'ValidationError' })
  })

  test('maps Prisma unique constraint (P2002) to 409 with friendly message', () => {
    const { reply, rec } = makeReply()
    // Simulate Prisma error object shape
    handleServerError(reply, { code: 'P2002', meta: { target: 'email' } })
    expect(rec.status).toBe(409)
    expect(rec.payload).toMatchObject({
      code: 409,
      errorType: 'PrismaUniqueError',
    })
  })

  test('generic error hides details when not in development', () => {
    const { reply, rec } = makeReply()
    const old = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    handleServerError(reply, new Error('secret details'))
    process.env.NODE_ENV = old
    expect(rec.status).toBe(500)
    // Should not leak original message in non-development env
    const payload = rec.payload
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      const msg = (payload as { message: string }).message
      expect(msg).toContain('Internal Server Error')
    } else {
      throw new Error('unexpected payload shape')
    }
  })

  test('maps Prisma record not found (P2025) to 404', () => {
    const { reply, rec } = makeReply()
    handleServerError(reply, { code: 'P2025' })
    expect(rec.status).toBe(404)
  })

  test('maps Octokit secondary rate limit to 429', () => {
    const { reply, rec } = makeReply()
    handleServerError(reply, {
      name: 'RequestError',
      status: 403,
      response: { headers: { 'retry-after': '3', 'x-ratelimit-remaining': '0' } },
    })
    expect(rec.status).toBe(429)
  })

  test('maps Octokit 5xx to 502', () => {
    const { reply, rec } = makeReply()
    handleServerError(reply, { name: 'RequestError', status: 502 })
    expect(rec.status).toBe(502)
  })

  test('maps timeout-like RequestError to 504', () => {
    const { reply, rec } = makeReply()
    handleServerError(reply, { name: 'RequestError', code: 'ETIMEDOUT' })
    expect(rec.status).toBe(504)
  })

  test('maps Redis unavailable to 503', () => {
    const { reply, rec } = makeReply()
    handleServerError(reply, { code: 'ECONNREFUSED' })
    expect(rec.status).toBe(503)
  })
})
