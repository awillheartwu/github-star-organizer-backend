import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const AiSummaryPlain = Type.Object(
  {
    id: Type.String(),
    projectId: Type.String(),
    style: Type.Union([Type.Literal('short'), Type.Literal('long')], {
      additionalProperties: false,
      description: `历史 AI 摘要（便于追溯不同模型/时间的结果）`,
    }),
    content: Type.String(),
    model: __nullable__(Type.String()),
    lang: __nullable__(Type.String()),
    tokens: __nullable__(Type.Integer()),
    createdAt: Type.String({ format: 'date-time' }),
  },
  { additionalProperties: false }
)

export const AiSummaryRelations = Type.Object(
  {
    project: Type.Object(
      {
        id: Type.String(),
        githubId: Type.Integer(),
        name: Type.String(),
        fullName: Type.String(),
        url: Type.String(),
        description: __nullable__(Type.String()),
        language: __nullable__(Type.String()),
        stars: Type.Integer(),
        forks: Type.Integer(),
        lastCommit: __nullable__(Type.String({ format: 'date-time' })),
        lastSyncAt: Type.String({ format: 'date-time' }),
        touchedAt: __nullable__(Type.String({ format: 'date-time' })),
        notes: __nullable__(Type.String()),
        favorite: Type.Boolean(),
        archived: Type.Boolean(),
        pinned: Type.Boolean(),
        score: __nullable__(Type.Integer()),
        summaryShort: __nullable__(Type.String()),
        summaryLong: __nullable__(Type.String()),
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
        deletedAt: __nullable__(Type.String({ format: 'date-time' })),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
)

export const AiSummaryWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          OR: Type.Array(Self, { additionalProperties: false }),
          id: Type.String(),
          projectId: Type.String(),
          style: Type.Union([Type.Literal('short'), Type.Literal('long')], {
            additionalProperties: false,
            description: `历史 AI 摘要（便于追溯不同模型/时间的结果）`,
          }),
          content: Type.String(),
          model: Type.String(),
          lang: Type.String(),
          tokens: Type.Integer(),
          createdAt: Type.String({ format: 'date-time' }),
        },
        { additionalProperties: false }
      ),
    { $id: 'AiSummary' }
  )
)

export const AiSummaryWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(Type.Object({ id: Type.String() }, { additionalProperties: false }), {
          additionalProperties: false,
        }),
        Type.Union([Type.Object({ id: Type.String() })], {
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
              id: Type.String(),
              projectId: Type.String(),
              style: Type.Union([Type.Literal('short'), Type.Literal('long')], {
                additionalProperties: false,
                description: `历史 AI 摘要（便于追溯不同模型/时间的结果）`,
              }),
              content: Type.String(),
              model: Type.String(),
              lang: Type.String(),
              tokens: Type.Integer(),
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
    { additionalProperties: false }
  )
)

export const AiSummaryInclude = Type.Partial(
  Type.Object(
    { project: Type.Boolean(), style: Type.Boolean(), _count: Type.Boolean() },
    { additionalProperties: false }
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
    { additionalProperties: false }
  )
)

export const AiSummary = Type.Composite([AiSummaryPlain, AiSummaryRelations], {
  additionalProperties: false,
})
