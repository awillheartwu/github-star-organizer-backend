import Fastify from 'fastify'
import closeWithGrace from 'close-with-grace'
import formbody from '@fastify/formbody'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { handleServerError } from './helpers/error.helper'
import { config } from './config'

import fastifySwagger from '@fastify/swagger'
import fastifySwaggerUI from '@fastify/swagger-ui'

async function bootstrap() {
  const app = Fastify({
    logger: { level: config.logLevel || 'info' },
  }).withTypeProvider<TypeBoxTypeProvider>()

  app.register(formbody)
  app.register(cors)
  app.register(helmet)

  // 错误处理
  app.setErrorHandler((error, request, reply) => {
    handleServerError(reply, error)
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

  await app.ready()
  app.swagger()

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
