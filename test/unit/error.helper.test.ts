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
})
