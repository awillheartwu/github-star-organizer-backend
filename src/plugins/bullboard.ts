// src/plugins/bullboard.ts
import fp from 'fastify-plugin'

export default fp(
  async (app) => {
    if (!app.config.bullUiEnabled) return
    // Lazy import to avoid optional deps impacting cold start/tests
    const { createBullBoard } = await import('@bull-board/api')
    const { FastifyAdapter } = await import('@bull-board/fastify')
    const { BullMQAdapter } = await import('@bull-board/api/bullMQAdapter')

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
        await instance.register(adapter.registerPlugin())
      },
      { prefix: basePath }
    )
  },
  { name: 'bullboard', dependencies: ['config', 'auth-plugin'] }
)
