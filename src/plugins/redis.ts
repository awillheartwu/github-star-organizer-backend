// src/plugins/redis.ts
import fp from 'fastify-plugin'
import IORedis from 'ioredis'

export default fp(
  async (app) => {
    const redis = new IORedis({
      host: app.config.redisHost,
      port: app.config.redisPort,
      password: app.config.redisPassword,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    })
    app.decorate('redis', redis)

    app.addHook('onClose', async () => {
      await redis.quit()
    })
  },
  { name: 'redis', dependencies: ['config'] }
)
