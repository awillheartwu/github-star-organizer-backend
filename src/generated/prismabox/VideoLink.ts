import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const VideoLinkPlain = Type.Object(
  {
    id: Type.String(),
    url: Type.String(),
    projectId: Type.String(),
    archived: Type.Boolean(),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
    deletedAt: __nullable__(Type.String({ format: 'date-time' })),
  },
  { additionalProperties: false }
)

export const VideoLinkRelations = Type.Object(
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
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
        deletedAt: __nullable__(Type.String({ format: 'date-time' })),
      },
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
)

export const VideoLinkWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          OR: Type.Array(Self, { additionalProperties: false }),
          id: Type.String(),
          url: Type.String(),
          projectId: Type.String(),
          archived: Type.Boolean(),
          createdAt: Type.String({ format: 'date-time' }),
          updatedAt: Type.String({ format: 'date-time' }),
          deletedAt: Type.String({ format: 'date-time' }),
        },
        { additionalProperties: false }
      ),
    { $id: 'VideoLink' }
  )
)

export const VideoLinkWhereUnique = Type.Recursive(
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
              url: Type.String(),
              projectId: Type.String(),
              archived: Type.Boolean(),
              createdAt: Type.String({ format: 'date-time' }),
              updatedAt: Type.String({ format: 'date-time' }),
              deletedAt: Type.String({ format: 'date-time' }),
            },
            { additionalProperties: false }
          )
        ),
      ],
      { additionalProperties: false }
    ),
  { $id: 'VideoLink' }
)

export const VideoLinkSelect = Type.Partial(
  Type.Object(
    {
      id: Type.Boolean(),
      url: Type.Boolean(),
      project: Type.Boolean(),
      projectId: Type.Boolean(),
      archived: Type.Boolean(),
      createdAt: Type.Boolean(),
      updatedAt: Type.Boolean(),
      deletedAt: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false }
  )
)

export const VideoLinkInclude = Type.Partial(
  Type.Object({ project: Type.Boolean(), _count: Type.Boolean() }, { additionalProperties: false })
)

export const VideoLinkOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      url: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      projectId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      archived: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      createdAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      updatedAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      deletedAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false }
  )
)

export const VideoLink = Type.Composite([VideoLinkPlain, VideoLinkRelations], {
  additionalProperties: false,
})
