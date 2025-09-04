// src/schemas/admin.schema.ts
import { Type } from '@sinclair/typebox'
export const AdminTag = 'Admin'

export const SetRoleBodySchema = Type.Object({
  userId: Type.String(),
  role: Type.Union([Type.Literal('USER'), Type.Literal('ADMIN')]),
})

export const BasicMessageSchema = Type.Object({ message: Type.String() })

// 手动触发 GitHub stars 同步
export const SyncStarsBodySchema = Type.Object({
  mode: Type.Union([Type.Literal('full'), Type.Literal('incremental')], { default: 'incremental' }),
  perPage: Type.Optional(Type.Number({ minimum: 1, maximum: 100 })),
  maxPages: Type.Optional(Type.Number({ minimum: 0 })),
  softDeleteUnstarred: Type.Optional(Type.Boolean()),
  note: Type.Optional(Type.String()),
})

export const EnqueueResponseSchema = Type.Object({
  message: Type.String(),
  jobId: Type.String(),
})

// 与全局 AppError 对齐的错误响应形状
export const ErrorResponseSchema = Type.Object({
  message: Type.String(),
  code: Type.Number(),
  errorType: Type.String(),
})

// 手动触发冲突的专用错误响应（附带 jobId/state）
export const ConflictEnqueueErrorSchema = Type.Intersect([
  ErrorResponseSchema,
  Type.Object({
    jobId: Type.Optional(Type.String()),
    state: Type.Optional(Type.String()),
  }),
])

export const SyncStateResponseSchema = Type.Object({
  id: Type.String(),
  source: Type.String(),
  key: Type.String(),
  cursor: Type.Optional(Type.String()),
  etag: Type.Optional(Type.String()),
  lastRunAt: Type.Optional(Type.String()),
  lastSuccessAt: Type.Optional(Type.String()),
  lastErrorAt: Type.Optional(Type.String()),
  lastError: Type.Optional(Type.String()),
  statsJson: Type.Optional(Type.String()),
  updatedAt: Type.String(),
})

// —— 归档项目（只读） —— //
export const ArchivedReasonSchema = Type.Union([Type.Literal('manual'), Type.Literal('unstarred')])

export const ArchivedProjectSchema = Type.Object({
  id: Type.String(),
  githubId: Type.Optional(Type.Integer()),
  reason: ArchivedReasonSchema,
  archivedAt: Type.String(),
  snapshot: Type.Unknown(),
})

export const ArchivedProjectListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  reason: Type.Optional(ArchivedReasonSchema),
})

export const ArchivedProjectListResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Array(ArchivedProjectSchema),
  page: Type.Number(),
  pageSize: Type.Number(),
  total: Type.Number(),
})

export const ArchivedProjectDetailResponseSchema = Type.Object({
  message: Type.String(),
  data: ArchivedProjectSchema,
})
