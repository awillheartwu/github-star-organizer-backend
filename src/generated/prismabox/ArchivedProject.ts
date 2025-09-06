import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const ArchivedProjectPlain = Type.Object(
  {
    id: Type.String(),
    githubId: __nullable__(Type.Integer({ description: `GitHub 项目 ID（非唯一，允许多次归档）` })),
    originalProjectId: __nullable__(Type.String()),
    reason: Type.Union([Type.Literal('manual'), Type.Literal('unstarred')], {
      additionalProperties: false,
      description: `归档原因`,
    }),
    snapshot: Type.Any({ description: `归档时的完整项目信息快照（JSON）` }),
    archivedAt: Type.String({ format: 'date-time' }),
  },
  {
    additionalProperties: false,
    description: `归档的 Project 快照（允许同一 githubId 多次归档）`,
  }
)

export const ArchivedProjectRelations = Type.Object(
  {},
  {
    additionalProperties: false,
    description: `归档的 Project 快照（允许同一 githubId 多次归档）`,
  }
)

export const ArchivedProjectWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          OR: Type.Array(Self, { additionalProperties: false }),
          id: Type.String(),
          githubId: Type.Integer({
            description: `GitHub 项目 ID（非唯一，允许多次归档）`,
          }),
          originalProjectId: Type.String(),
          reason: Type.Union([Type.Literal('manual'), Type.Literal('unstarred')], {
            additionalProperties: false,
            description: `归档原因`,
          }),
          snapshot: Type.Any({
            description: `归档时的完整项目信息快照（JSON）`,
          }),
          archivedAt: Type.String({ format: 'date-time' }),
        },
        {
          additionalProperties: false,
          description: `归档的 Project 快照（允许同一 githubId 多次归档）`,
        }
      ),
    { $id: 'ArchivedProject' }
  )
)

export const ArchivedProjectWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            { id: Type.String() },
            {
              additionalProperties: false,
              description: `归档的 Project 快照（允许同一 githubId 多次归档）`,
            }
          ),
          { additionalProperties: false }
        ),
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
              githubId: Type.Integer({
                description: `GitHub 项目 ID（非唯一，允许多次归档）`,
              }),
              originalProjectId: Type.String(),
              reason: Type.Union([Type.Literal('manual'), Type.Literal('unstarred')], {
                additionalProperties: false,
                description: `归档原因`,
              }),
              snapshot: Type.Any({
                description: `归档时的完整项目信息快照（JSON）`,
              }),
              archivedAt: Type.String({ format: 'date-time' }),
            },
            { additionalProperties: false }
          )
        ),
      ],
      { additionalProperties: false }
    ),
  { $id: 'ArchivedProject' }
)

export const ArchivedProjectSelect = Type.Partial(
  Type.Object(
    {
      id: Type.Boolean(),
      githubId: Type.Boolean(),
      originalProjectId: Type.Boolean(),
      reason: Type.Boolean(),
      snapshot: Type.Boolean(),
      archivedAt: Type.Boolean(),
      _count: Type.Boolean(),
    },
    {
      additionalProperties: false,
      description: `归档的 Project 快照（允许同一 githubId 多次归档）`,
    }
  )
)

export const ArchivedProjectInclude = Type.Partial(
  Type.Object(
    { reason: Type.Boolean(), _count: Type.Boolean() },
    {
      additionalProperties: false,
      description: `归档的 Project 快照（允许同一 githubId 多次归档）`,
    }
  )
)

export const ArchivedProjectOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      githubId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      originalProjectId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      snapshot: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      archivedAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
    },
    {
      additionalProperties: false,
      description: `归档的 Project 快照（允许同一 githubId 多次归档）`,
    }
  )
)

export const ArchivedProject = Type.Composite([ArchivedProjectPlain, ArchivedProjectRelations], {
  additionalProperties: false,
})
