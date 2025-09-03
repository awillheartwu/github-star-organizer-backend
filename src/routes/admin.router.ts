// src/routes/admin.router.ts
import { FastifyInstance } from 'fastify'
import { adminController } from '../controllers'
import {
  AdminTag,
  SetRoleBodySchema,
  BasicMessageSchema,
  SyncStarsBodySchema,
  EnqueueResponseSchema,
  ErrorResponseSchema,
  ConflictEnqueueErrorSchema,
  SyncStateResponseSchema,
} from '../schemas/admin.schema'

export default async function adminRoutes(fastify: FastifyInstance) {
  fastify.post(
    '/admin/set-role',
    {
      config: {
        rateLimit: {
          groupId: 'admin-set-role',
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

  // 手动触发 GitHub stars 同步（ADMIN）
  fastify.post(
    '/admin/sync-stars',
    {
      config: {
        rateLimit: {
          groupId: 'admin-sync-stars',
          timeWindow: fastify.config.rateLimitWindow,
          max: Math.min(fastify.config.rateLimitMax, 5),
          hook: 'onRequest',
        },
      },
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Enqueue GitHub stars sync (ADMIN)',
        description: '手动入列 GitHub stars 同步任务，仅限 ADMIN 访问',
        body: SyncStarsBodySchema,
        response: { 200: EnqueueResponseSchema, 409: ConflictEnqueueErrorSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.enqueueSyncStars
  )

  // 查询当前 SyncState（ADMIN）
  fastify.get(
    '/admin/sync-state',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Get current sync state (ADMIN)',
        description: '查询当前同步状态，仅限 ADMIN 访问',
        response: { 200: SyncStateResponseSchema, 404: ErrorResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.getSyncStateAdmin
  )
}
