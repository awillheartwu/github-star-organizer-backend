// src/routes/ai.router.ts
import { FastifyInstance } from 'fastify'
import * as aiController from '../controllers/ai.controller'
import { AiTag, BodySchema, ResponseSchema } from '../schemas/ai.schema'

export default async function aiRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/ai/projects/:id/summary',
    {
      config: {
        rateLimit: {
          groupId: 'ai-summary',
          timeWindow: fastify.config.rateLimitWindow,
          max: Math.min(fastify.config.rateLimitMax, 2),
          hook: 'onRequest',
        },
      },
      onRequest: [fastify.verifyAccess, fastify.roleGuard('USER')],
      schema: {
        tags: [AiTag],
        summary: 'Generate AI summary for project',
        body: BodySchema,
        response: {
          200: ResponseSchema,
        },
        security: [{ bearerAuth: [] }],
      },
    },
    aiController.summarizeProject
  )
}
