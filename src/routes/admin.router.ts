// src/routes/admin.router.ts
import { FastifyInstance } from 'fastify'
import { adminController } from '../controllers'
import { AdminTag, SetRoleBodySchema, BasicMessageSchema } from '../schemas/admin.schema'

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/admin/set-role',
    {
      config: {
        rateLimit: {
          timeWindow: fastify.config.rateLimitWindow,
          max: Math.min(fastify.config.rateLimitMax, 10),
          hook: 'onRequest',
        },
      },
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')], // ★ 必须 ADMIN
      schema: {
        tags: [AdminTag],
        summary: 'Set user role (ADMIN only)',
        description: '设置用户角色，仅限 ADMIN 访问',
        body: SetRoleBodySchema,
        response: { 200: BasicMessageSchema },
        security: [{ bearerAuth: [] }], // swagger 需要带 AT
      },
    },
    adminController.setRole
  )
}
