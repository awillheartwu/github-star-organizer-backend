import { Type } from '@sinclair/typebox'
import { Project } from '../generated/prismabox/Project'

export const ProjectQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ default: 1 })),
  pageSize: Type.Optional(Type.Number({ default: 10 })),
})

export const BaseProjectResponseSchema = Type.Object({
  message: Type.String(),
  data: Project,
})

export const ProjectListResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Array(Project),
  page: Type.Number(),
  pageSize: Type.Number(),
  total: Type.Number(),
})

export const Tag = Type.Object({
  id: Type.Optional(Type.String()),
  name: Type.String(),
  description: Type.Optional(Type.String()),
})

export const CreateProjectBodySchema = Type.Object({
  githubId: Type.Integer(),
  name: Type.String(),
  fullName: Type.String(),
  url: Type.String(),
  description: Type.Optional(Type.String()),
  language: Type.Optional(Type.String()),
  stars: Type.Optional(Type.Integer()),
  forks: Type.Optional(Type.Integer()),
  lastCommit: Type.Optional(Type.String({ format: 'date-time' })),
  notes: Type.Optional(Type.String()),
  favorite: Type.Optional(Type.Boolean()),
  archived: Type.Optional(Type.Boolean()),
  pinned: Type.Optional(Type.Boolean()),
  score: Type.Optional(Type.Integer()),
  tags: Type.Optional(Type.Array(Tag)), // 可选，关联标签
  videoLinks: Type.Optional(Type.Array(Type.String())), // 可选，关联视频链接
})
