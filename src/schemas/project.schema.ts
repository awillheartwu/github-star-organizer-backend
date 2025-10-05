import { Type } from '@sinclair/typebox'

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

// —— 与 controller 返回的 DTO 对齐 —— //
const TagSummary = Type.Object({
  id: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
})

export const ProjectDtoSchema = Type.Object(
  {
    id: Type.String(),
    githubId: Type.Integer(),
    name: Type.String(),
    fullName: Type.String(),
    url: Type.String(),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    language: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    stars: Type.Integer(),
    forks: Type.Integer(),
    lastCommit: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    lastSyncAt: Type.String({ format: 'date-time' }),
    touchedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    favorite: Type.Boolean(),
    archived: Type.Boolean(),
    pinned: Type.Boolean(),
    score: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    // 新增的冗余摘要字段（可选）
    summaryShort: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    summaryLong: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
    deletedAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    tags: Type.Array(TagSummary),
    videoLinks: Type.Array(Type.String()),
  },
  { additionalProperties: false }
)

export const BaseProjectResponseSchema = Type.Object({
  message: Type.String(),
  data: ProjectDtoSchema,
})

export const ProjectListResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Array(ProjectDtoSchema),
  page: Type.Number(),
  pageSize: Type.Number(),
  total: Type.Number(),
})

export const ProjectLanguageListResponseSchema = Type.Object({
  message: Type.String(),
  data: Type.Array(Type.String()),
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

// 更新白名单：仅允许业务可编辑字段（来源字段只读，交由同步任务维护）
export const UpdateProjectBodySchema = Type.Object(
  {
    notes: Type.Optional(Type.String()),
    favorite: Type.Optional(Type.Boolean()),
    archived: Type.Optional(Type.Boolean()),
    pinned: Type.Optional(Type.Boolean()),
    score: Type.Optional(Type.Integer()),
    tags: Type.Optional(Type.Array(Tag)),
    videoLinks: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false }
)
