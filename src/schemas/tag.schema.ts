import { Type } from '@sinclair/typebox'
import { TagPlain as TagPublic } from '../generated/prismabox/Tag'
import { ProjectPlain as ProjectPublic } from '../generated/prismabox/Project'

export const TagQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),

  archived: Type.Optional(Type.Boolean()),
  keyword: Type.Optional(Type.String()),
  orderBy: Type.Optional(
    Type.Union([Type.Literal('createdAt'), Type.Literal('updatedAt'), Type.Literal('name')])
  ),
  orderDirection: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
})

export const TagDetailQuerySchema = Type.Object({
  projectsPage: Type.Optional(Type.Integer({ minimum: 1 })),
  projectsPageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
})

// 项目精简字段（用于 Tag 详情里的 projects 数组）
const ProjectBrief = Type.Pick(ProjectPublic, ['id', 'name', 'fullName', 'url'] as const)

// Tag 详情：Tag 的公开字段 + projects 的精简项目列表
export const TagDetailSchema = Type.Intersect([
  TagPublic,
  Type.Object({
    projects: Type.Array(ProjectBrief),
    projectsTotal: Type.Number(),
    projectsPage: Type.Number(),
    projectsPageSize: Type.Number(),
  }),
])

export const BaseTagResponseSchema = Type.Object({
  message: Type.String(),
  data: TagDetailSchema,
})

export const TagCreateResponseSchema = Type.Object({
  message: Type.String(),
  data: TagPublic,
})

// 标签列表响应：包含分页信息和标签数组
export const TagListResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Array(TagPublic),
  page: Type.Number(),
  pageSize: Type.Number(),
  total: Type.Number(),
})

export const CreateTagBodySchema = Type.Object({
  name: Type.String(),
  description: Type.Optional(Type.String()),
})
