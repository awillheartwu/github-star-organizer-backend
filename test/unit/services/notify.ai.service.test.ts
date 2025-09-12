// test/unit/services/notify.ai.service.test.ts
import type { FastifyInstance } from 'fastify'
import * as notify from '../../../src/services/notify.service'

describe('NotifyService — AI related', () => {
  let app: FastifyInstance
  beforeEach(() => {
    app = {
      config: { notifyEmailEnabled: true, mailTo: 'a@ex.com' },
      mailer: { send: jest.fn(async () => void 0) },
    } as unknown as FastifyInstance
  })

  it('sendAiBatchCompleted sends one summary email', async () => {
    await notify.sendAiBatchCompleted(app, 'batch-1', {
      total: 10,
      ok: 8,
      fail: 2,
      startedAt: Date.now() - 1000,
      finishedAt: Date.now(),
      lang: 'zh',
      model: 'deepseek-chat',
      okList: [{ id: 'p1', name: 'proj 1' }],
      failList: [{ id: 'p9', name: 'proj 9', error: 'Oops' }],
    })
    expect(app.mailer.send as jest.Mock).toHaveBeenCalled()
    const arg = (app.mailer.send as jest.Mock).mock.calls[0][0]
    expect(arg.subject).toContain('Batch summary')
    expect(arg.html).toContain('batch-1')
  })

  it('sendAiProjectCompleted sends project email', async () => {
    await notify.sendAiProjectCompleted(app, 'job-1', 'pid', {
      name: 'test',
      url: 'https://example.com',
      model: 'deepseek-chat',
      lang: 'zh',
      tagsCreated: 1,
      tagsLinked: 2,
    })
    expect(app.mailer.send as jest.Mock).toHaveBeenCalled()
  })

  it('sendAiProjectFailed sends failure email', async () => {
    await notify.sendAiProjectFailed(app, 'job-2', 'pid', new Error('bad'))
    expect(app.mailer.send as jest.Mock).toHaveBeenCalled()
  })

  it('sendAiSweepCompleted sends sweep summary email', async () => {
    await notify.sendAiSweepCompleted(app, 'job-3', 5, 7)
    expect(app.mailer.send as jest.Mock).toHaveBeenCalled()
  })

  it('sendAiSweepFailed sends sweep failure email', async () => {
    await notify.sendAiSweepFailed(app, 'job-4', 'boom')
    expect(app.mailer.send as jest.Mock).toHaveBeenCalled()
  })
})
