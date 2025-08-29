import { Type } from '@sinclair/typebox'
import { Project } from '../generated/prismabox/Project'

export const ProjectQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),

    archived: Type.Optional(Type.Boolean()),
    favorite: Type.Optional(Type.Boolean()),
    pinned: Type.Optional(Type.Boolean()),

    name: Type.Optional(Type.String()),
    keyword: Type.Optional(Type.String()),

    language: Type.Optional(Type.String()),
    languages: Type.Optional(Type.Array(Type.String(), { uniqueItems: true })),

    starsMin: Type.Optional(Type.Integer({ minimum: 0 })),
    starsMax: Type.Optional(Type.Integer({ minimum: 0 })),
    forksMin: Type.Optional(Type.Integer({ minimum: 0 })),
    forksMax: Type.Optional(Type.Integer({ minimum: 0 })),

    tagNames: Type.Optional(Type.Array(Type.String(), { uniqueItems: true })),

    createdAtStart: Type.Optional(Type.String({ format: 'date-time' })), // ISO 字符串
    createdAtEnd: Type.Optional(Type.String({ format: 'date-time' })),
    updatedAtStart: Type.Optional(Type.String({ format: 'date-time' })),
    updatedAtEnd: Type.Optional(Type.String({ format: 'date-time' })),

    orderBy: Type.Optional(
      Type.Union([
        Type.Literal('createdAt'),
        Type.Literal('updatedAt'),
        Type.Literal('stars'),
        Type.Literal('forks'),
        Type.Literal('lastCommit'),
        Type.Literal('lastSyncAt'),
        Type.Literal('name'),
      ])
    ),
    orderDirection: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
  },
  { additionalProperties: false }
)

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
  archived: Type.Optional(Type.Boolean()),
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
