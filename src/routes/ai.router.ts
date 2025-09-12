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
      // 仅 ADMIN 允许触发 AI 摘要
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AiTag],
        summary: 'Generate AI summary for project',
        description: '为项目生成 AI 摘要',
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
