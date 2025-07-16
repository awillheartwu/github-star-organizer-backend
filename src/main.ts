import * as dotenv from 'dotenv'
import Fastify from 'fastify'
import closeWithGrace from 'close-with-grace'

import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'

dotenv.config()

async function bootstrap() {
  const app = Fastify({
    logger: true,
  })

  // 注册 Swagger
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: 'GitHub Star Organizer API',
        description: 'API Docs',
        version: '0.1.0',
      },
    },
  })

  await app.register(fastifySwaggerUI, {
    routePrefix: '/docs',
  })

  // 注册主业务插件
  await app.register(import('./app'))

  // 优雅关闭
  closeWithGrace(
    { delay: parseInt(process.env.FASTIFY_CLOSE_GRACE_DELAY || '500') },
    async ({ err }) => {
      if (err) app.log.error(err)
      await app.close()
    }
  )

  // 启动服务
  app.listen({ port: parseInt(process.env.PORT || '3000') }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
  })
}

bootstrap()
