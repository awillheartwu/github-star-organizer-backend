import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const ProjectTagPlain = Type.Object(
  { projectId: Type.String(), tagId: Type.String() },
  { additionalProperties: false, description: `项目-标签 关联表` }
)

export const ProjectTagRelations = Type.Object(
  {
    project: Type.Object(
      {
        id: Type.String({ description: `主键，UUID` }),
        githubId: Type.Integer({
          description: `GitHub 项目的唯一 ID（来自 GitHub API）`,
        }),
        name: Type.String({ description: `仓库名称（如 star-organizer）` }),
        fullName: Type.String({
          description: `仓库全名（如 user/star-organizer）`,
        }),
        url: Type.String({ description: `仓库链接` }),
        description: __nullable__(Type.String({ description: `项目描述` })),
        language: __nullable__(Type.String({ description: `主语言` })),
        stars: Type.Integer({ description: `Star 数量` }),
        forks: Type.Integer({ description: `Fork 数量` }),
        lastCommit: __nullable__(
          Type.String({
            format: 'date-time',
            description: `最后一次提交时间（可选）`,
          })
        ),
        lastSyncAt: Type.String({
          format: 'date-time',
          description: `最后同步时间`,
        }),
        touchedAt: __nullable__(
          Type.String({
            format: 'date-time',
            description: `最近一次被同步任务“触达”的时间（内容未变也会更新）`,
          })
        ),
        notes: __nullable__(Type.String({ description: `用户备注` })),
        favorite: Type.Boolean({ description: `是否标记为收藏` }),
        archived: Type.Boolean({ description: `是否归档` }),
        pinned: Type.Boolean({ description: `是否置顶` }),
        score: __nullable__(Type.Integer({ description: `用户评分（可选）` })),
        summaryShort: __nullable__(Type.String({ description: `最新 AI 摘要（短）` })),
        summaryLong: __nullable__(Type.String({ description: `最新 AI 摘要（长）` })),
        createdAt: Type.String({
          format: 'date-time',
          description: `创建时间`,
        }),
        updatedAt: Type.String({
          format: 'date-time',
          description: `更新时间（自动更新）`,
        }),
        deletedAt: __nullable__(
          Type.String({
            format: 'date-time',
            description: `软删除��间（可选）`,
          })
        ),
      },
      {
        additionalProperties: false,
        description: `GitHub 项目（来自 stars 同步）与用户侧标注信息`,
      }
    ),
    tag: Type.Object(
      {
        id: Type.String({ description: `主键，UUID` }),
        name: Type.String({ description: `标签名称（不再唯一，靠软删区分）` }),
        description: __nullable__(Type.String({ description: `标签描述（可选）` })),
        archived: Type.Boolean({ description: `是否归档` }),
        createdAt: Type.String({
          format: 'date-time',
          description: `创建时间`,
        }),
        updatedAt: Type.String({
          format: 'date-time',
          description: `更新时间（自动更新）`,
        }),
        deletedAt: __nullable__(
          Type.String({
            format: 'date-time',
            description: `软删除时间（可选）`,
          })
        ),
      },
      { additionalProperties: false, description: `标签表` }
    ),
  },
  { additionalProperties: false, description: `项目-标签 关联表` }
)

export const ProjectTagWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          OR: Type.Array(Self, { additionalProperties: false }),
          projectId: Type.String(),
          tagId: Type.String(),
        },
        { additionalProperties: false, description: `项目-标签 关联表` }
      ),
    { $id: 'ProjectTag' }
  )
)

export const ProjectTagWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object({}, { additionalProperties: false, description: `项目-标签 关联表` }),
          { additionalProperties: false }
        ),
        Type.Union([], { additionalProperties: false }),
        Type.Partial(
          Type.Object({
            AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
            NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
            OR: Type.Array(Self, { additionalProperties: false }),
          }),
          { additionalProperties: false }
        ),
        Type.Partial(
          Type.Object(
            { projectId: Type.String(), tagId: Type.String() },
            { additionalProperties: false }
          )
        ),
      ],
      { additionalProperties: false }
    ),
  { $id: 'ProjectTag' }
)

export const ProjectTagSelect = Type.Partial(
  Type.Object(
    {
      project: Type.Boolean(),
      projectId: Type.Boolean(),
      tag: Type.Boolean(),
      tagId: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false, description: `项目-标签 关联表` }
  )
)

export const ProjectTagInclude = Type.Partial(
  Type.Object(
    { project: Type.Boolean(), tag: Type.Boolean(), _count: Type.Boolean() },
    { additionalProperties: false, description: `项目-标签 关联表` }
  )
)

export const ProjectTagOrderBy = Type.Partial(
  Type.Object(
    {
      projectId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      tagId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false, description: `项目-标签 关联表` }
  )
)

export const ProjectTag = Type.Composite([ProjectTagPlain, ProjectTagRelations], {
  additionalProperties: false,
})
