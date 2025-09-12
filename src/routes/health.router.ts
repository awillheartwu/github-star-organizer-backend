import { FastifyInstance } from 'fastify'
import { HealthOkSchema, ReadyOkSchema, ReadyFailSchema } from '../schemas/health.schema'
import * as healthController from '../controllers/health.controller'

export default async function healthRoutes(app: FastifyInstance) {
  app.get(
    '/healthz',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        description: '健康检查',
        response: { 200: HealthOkSchema },
      },
    },
    healthController.healthz
  )

  app.get(
    '/readyz',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness check',
        description: '检查服务的就绪状态',
        response: { 200: ReadyOkSchema, 503: ReadyFailSchema },
      },
    },
    healthController.readyz
  )
}
