// src/routes/admin.router.ts
import { FastifyInstance } from 'fastify'
import { Type } from '@sinclair/typebox'
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
  ArchivedProjectListQuerySchema,
  ArchivedProjectListResponseSchema,
  ArchivedProjectDetailResponseSchema,
  AiEnqueueBodySchema,
  AiEnqueueResultSchema,
  AiSweepBodySchema,
  AiSweepResultSchema,
  AiBatchListQuerySchema,
  AiBatchListResponseSchema,
  AiBatchDetailResponseSchema,
  QueuesStatusResponseSchema,
  MaintenanceRunResponseSchema,
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

  // 归档项目列表（ADMIN only，只读）
  fastify.get(
    '/admin/archived-projects',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'List archived projects (ADMIN)',
        description: '只读归档项目列表',
        querystring: ArchivedProjectListQuerySchema,
        response: { 200: ArchivedProjectListResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.listArchivedProjects
  )

  // 归档项目详情（ADMIN only，只读）
  fastify.get(
    '/admin/archived-projects/:id',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Get archived project detail (ADMIN)',
        description: '归档项目详情',
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 200: ArchivedProjectDetailResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.getArchivedProjectById
  )

  // —— AI 摘要相关 —— //
  fastify.post(
    '/admin/ai/summary/enqueue',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Enqueue AI summary for projects (ADMIN)',
        description: '为项目入列 AI 摘要任务，仅限 ADMIN 访问',
        body: AiEnqueueBodySchema,
        response: { 200: AiEnqueueResultSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.enqueueAiSummary
  )

  fastify.post(
    '/admin/ai/summary/sweep',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Sweep and enqueue AI summary jobs (ADMIN)',
        description: '批量扫描并入列 AI 摘要任务，仅限 ADMIN 访问',
        body: AiSweepBodySchema,
        response: { 200: AiSweepResultSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.enqueueAiSweep
  )

  // —— AI 批次追踪 —— //
  fastify.get(
    '/admin/ai/batches',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'List AI batches (ADMIN)',
        description: '列出 AI 批次，仅限 ADMIN 访问',
        querystring: AiBatchListQuerySchema,
        response: { 200: AiBatchListResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.listAiBatches
  )

  fastify.get(
    '/admin/ai/batches/:id',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Get AI batch detail (ADMIN)',
        description: 'AI 批次详情，仅限 ADMIN 访问',
        response: { 200: AiBatchDetailResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.getAiBatchById
  )

  // —— 队列状态 —— //
  fastify.get(
    '/admin/queues',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Get queues status (ADMIN)',
        description: '查询队列状态，仅限 ADMIN 访问',
        response: { 200: QueuesStatusResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.getQueuesStatus
  )

  // 在 Swagger 中提供一个跳转入口，便于通过 Authorize 后点击访问可视化界面
  fastify.get(
    '/admin/queues/ui-link',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Open Bull Board UI (redirect)',
        description: '跳转到 Bull Board 可视化界面，仅限 ADMIN 访问',
        security: [{ bearerAuth: [] }],
      },
    },
    async (_req, reply) => {
      const base = fastify.config.bullUiPath || '/admin/queues/ui'
      const target = base.endsWith('/') ? base : base + '/'
      return reply.redirect(target, 302)
    }
  )

  // —— 立即触发维护 —— //
  fastify.post(
    '/admin/maintenance/run',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        tags: [AdminTag],
        summary: 'Run maintenance now (ADMIN)',
        description: '立即触发维护任务，仅限 ADMIN 访问',
        response: { 200: MaintenanceRunResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    adminController.runMaintenanceNow
  )
}
