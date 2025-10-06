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
  // 监听未捕获异常（结构化 JSON 输出，便于集中日志采集）
  process.on('unhandledRejection', (reason) => {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        at: 'process.unhandledRejection',
        level: 'error',
        message: 'Unhandled promise rejection',
        reason: (reason as Error)?.message || String(reason),
        stack: (reason as Error)?.stack,
      })
    )
  })
  process.on('uncaughtException', (err) => {
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        at: 'process.uncaughtException',
        level: 'fatal',
        message: 'Uncaught exception',
        error: (err as Error).message,
        stack: (err as Error).stack,
      })
    )
    process.exit(1)
  })
  const app = Fastify({
    logger: { level: config.logLevel || 'info' },
    trustProxy: config.trustProxy,
    bodyLimit: config.bodyLimit,
  }).withTypeProvider<TypeBoxTypeProvider>()

  await app.register(formbody)
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: config.corsCredentials,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
  await app.register(helmet, {
    contentSecurityPolicy: config.helmetCsp
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https:'],
            objectSrc: ["'none'"],
          },
        }
      : false,
  })

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
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      // security: [{ bearerAuth: [] }],
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
  closeWithGrace({ delay: parseInt(config.fastifyCloseGraceDelay) }, async ({ err }) => {
    if (err) app.log.error(err)
    await app.close()
  })

  // 启动服务
  app.listen({ port: config.port! }, (err) => {
    if (err) {
      app.log.error(err)
      process.exit(1)
    }
  })
}

bootstrap()
