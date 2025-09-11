import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const AiSummaryPlain = Type.Object(
  {
    id: Type.String({ description: `主键` }),
    projectId: Type.String({ description: `所属项目` }),
    style: Type.Union([Type.Literal('short'), Type.Literal('long')], {
      additionalProperties: false,
      description: `历史 AI 摘要（便于追溯不同模型/时间的结果）`,
    }),
    content: Type.String({ description: `使用的模型` }),
    model: __nullable__(Type.String({ description: `模型名称` })),
    lang: __nullable__(Type.String({ description: `模型版本` })),
    tokens: __nullable__(Type.Integer({ description: `使用的 tokens 数（可选）` })),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false, description: `AI 摘要历史记录` }
)

export const AiSummaryRelations = Type.Object(
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
        aiSummarizedAt: __nullable__(
          Type.String({
            format: 'date-time',
            description: `最近一次成功生成 AI 摘要的时间（用于增量/TTL 判断）`,
          })
        ),
        aiSummaryLang: __nullable__(Type.String({ description: `最近一次摘要所使用的语言` })),
        aiSummaryModel: __nullable__(Type.String({ description: `最近一次摘要所使用的模型` })),
        aiSummarySourceHash: __nullable__(
          Type.String({
            description: `最近一次摘要的输入源哈希（可选，用于精准失效识别）`,
          })
        ),
        aiSummaryError: __nullable__(
          Type.String({
            description: `最近一次摘要错误信息（可选，仅用于诊断）`,
          })
        ),
        aiSummaryErrorAt: __nullable__(
          Type.String({
            format: 'date-time',
            description: `最近一次摘要错误时间`,
          })
        ),
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
      {
        additionalProperties: false,
        description: `GitHub 项目（来自 stars 同步）与用户侧标注信息`,
      }
    ),
  },
  { additionalProperties: false, description: `AI 摘要历史记录` }
)

export const AiSummaryWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          OR: Type.Array(Self, { additionalProperties: false }),
          id: Type.String({ description: `主键` }),
          projectId: Type.String({ description: `所属项目` }),
          style: Type.Union([Type.Literal('short'), Type.Literal('long')], {
            additionalProperties: false,
            description: `历史 AI 摘要（便于追溯不同模型/时间的结果）`,
          }),
          content: Type.String({ description: `使用的模型` }),
          model: Type.String({ description: `模型名称` }),
          lang: Type.String({ description: `模型版本` }),
          tokens: Type.Integer({ description: `使用的 tokens 数（可选）` }),
          createdAt: Type.String({ format: 'date-time' }),
        },
        { additionalProperties: false, description: `AI 摘要历史记录` }
      ),
    { $id: 'AiSummary' }
  )
)

export const AiSummaryWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            { id: Type.String({ description: `主键` }) },
            { additionalProperties: false, description: `AI 摘要历史记录` }
          ),
          { additionalProperties: false }
        ),
        Type.Union([Type.Object({ id: Type.String({ description: `主键` }) })], {
          additionalProperties: false,
        }),
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
            {
              id: Type.String({ description: `主键` }),
              projectId: Type.String({ description: `所属项目` }),
              style: Type.Union([Type.Literal('short'), Type.Literal('long')], {
                additionalProperties: false,
                description: `历史 AI 摘要（便于追溯不同模型/时间的结果）`,
              }),
              content: Type.String({ description: `使用的模型` }),
              model: Type.String({ description: `模型名称` }),
              lang: Type.String({ description: `模型版本` }),
              tokens: Type.Integer({ description: `使用的 tokens 数（可选）` }),
              createdAt: Type.String({ format: 'date-time' }),
            },
            { additionalProperties: false }
          )
        ),
      ],
      { additionalProperties: false }
    ),
  { $id: 'AiSummary' }
)

export const AiSummarySelect = Type.Partial(
  Type.Object(
    {
      id: Type.Boolean(),
      projectId: Type.Boolean(),
      project: Type.Boolean(),
      style: Type.Boolean(),
      content: Type.Boolean(),
      model: Type.Boolean(),
      lang: Type.Boolean(),
      tokens: Type.Boolean(),
      createdAt: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false, description: `AI 摘要历史记录` }
  )
)

export const AiSummaryInclude = Type.Partial(
  Type.Object(
    { project: Type.Boolean(), style: Type.Boolean(), _count: Type.Boolean() },
    { additionalProperties: false, description: `AI 摘要历史记录` }
  )
)

export const AiSummaryOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      projectId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      content: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      model: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      lang: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      tokens: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      createdAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false, description: `AI 摘要历史记录` }
  )
)

export const AiSummary = Type.Composite([AiSummaryPlain, AiSummaryRelations], {
  additionalProperties: false,
})
