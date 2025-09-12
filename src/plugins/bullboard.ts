// src/plugins/bullboard.ts
import fp from 'fastify-plugin'
import { AppError } from '../helpers/error.helper'

export default fp(
  async (app) => {
    if (!app.config.bullUiEnabled) return
    // Lazy import to avoid optional deps impacting cold start/tests
    type FastifyAdapterInstance = {
      setBasePath: (p: string) => void
      // bull-board fastify adapter returns a fastify plugin function
      registerPlugin: () =>
        | import('fastify').FastifyPluginCallback
        | import('fastify').FastifyPluginAsync
    }
    type FastifyAdapterCtor = { new (): FastifyAdapterInstance }
    type BullMQAdapterCtor = { new (q: import('bullmq').Queue): unknown }
    type CreateBullBoardFn = (args: {
      queues: unknown[]
      serverAdapter: unknown
      options?: { uiConfig?: { boardTitle?: string } }
    }) => unknown

    let createBullBoard: CreateBullBoardFn
    let FastifyAdapter: FastifyAdapterCtor
    let BullMQAdapter: BullMQAdapterCtor
    try {
      const apiMod = await import('@bull-board/api')
      const fastifyMod = await import('@bull-board/fastify')
      const mqMod = await import('@bull-board/api/bullMQAdapter')
      createBullBoard = apiMod.createBullBoard as CreateBullBoardFn
      FastifyAdapter = fastifyMod.FastifyAdapter as FastifyAdapterCtor
      BullMQAdapter = mqMod.BullMQAdapter as BullMQAdapterCtor
    } catch (e) {
      app.log.error({ e }, '[bullboard] failed to import bull-board packages; UI disabled')
      return
    }

    const adapter = new FastifyAdapter()
    const basePath = app.config.bullUiPath || '/admin/queues/ui'
    adapter.setBasePath(basePath)

    const queues = [] as Array<InstanceType<typeof BullMQAdapter>>
    try {
      if (app.queues?.syncStars) {
        queues.push(new BullMQAdapter(app.queues.syncStars as unknown as import('bullmq').Queue))
      }
      if (app.queues?.aiSummary) {
        queues.push(new BullMQAdapter(app.queues.aiSummary as unknown as import('bullmq').Queue))
      }
      if (app.queues?.maintenance) {
        queues.push(new BullMQAdapter(app.queues.maintenance as unknown as import('bullmq').Queue))
      }
    } catch {
      // ignore if queues not ready
    }

    createBullBoard({
      queues,
      serverAdapter: adapter,
      options: { uiConfig: { boardTitle: 'Queues' } },
    })

    await app.register(
      async (instance) => {
        instance.addHook('onRequest', app.verifyAccess)
        instance.addHook('onRequest', app.roleGuard('ADMIN'))
        // 只读模式：阻止对 bull-board mutation endpoints 的非幂等请求
        if (app.config.bullUiReadOnly) {
          instance.addHook('onRequest', async (req) => {
            // 允许 GET / HEAD / OPTIONS
            const m = req.method.toUpperCase()
            if (!['GET', 'HEAD', 'OPTIONS'].includes(m)) {
              throw new AppError('Bull Board is read-only', 403, 'ForbiddenError')
            }
          })
        }
        await instance.register(adapter.registerPlugin())
      },
      { prefix: basePath }
    )
  },
  { name: 'bullboard', dependencies: ['config', 'auth-plugin'] }
)
