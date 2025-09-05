import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const ProjectPlain = Type.Object(
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
)

export const ProjectRelations = Type.Object(
  {
    videoLinks: Type.Array(
      Type.Object(
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
      ),
      { additionalProperties: false }
    ),
    tags: Type.Array(
      Type.Object(
        { projectId: Type.String(), tagId: Type.String() },
        { additionalProperties: false }
      ),
      { additionalProperties: false }
    ),
  },
  { additionalProperties: false }
)

export const ProjectWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          OR: Type.Array(Self, { additionalProperties: false }),
          id: Type.String(),
          githubId: Type.Integer(),
          name: Type.String(),
          fullName: Type.String(),
          url: Type.String(),
          description: Type.String(),
          language: Type.String(),
          stars: Type.Integer(),
          forks: Type.Integer(),
          lastCommit: Type.String({ format: 'date-time' }),
          lastSyncAt: Type.String({ format: 'date-time' }),
          touchedAt: Type.String({ format: 'date-time' }),
          notes: Type.String(),
          favorite: Type.Boolean(),
          archived: Type.Boolean(),
          pinned: Type.Boolean(),
          score: Type.Integer(),
          createdAt: Type.String({ format: 'date-time' }),
          updatedAt: Type.String({ format: 'date-time' }),
          deletedAt: Type.String({ format: 'date-time' }),
        },
        { additionalProperties: false }
      ),
    { $id: 'Project' }
  )
)

export const ProjectWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            { id: Type.String(), githubId: Type.Integer() },
            { additionalProperties: false }
          ),
          { additionalProperties: false }
        ),
        Type.Union(
          [Type.Object({ id: Type.String() }), Type.Object({ githubId: Type.Integer() })],
          { additionalProperties: false }
        ),
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
              githubId: Type.Integer(),
              name: Type.String(),
              fullName: Type.String(),
              url: Type.String(),
              description: Type.String(),
              language: Type.String(),
              stars: Type.Integer(),
              forks: Type.Integer(),
              lastCommit: Type.String({ format: 'date-time' }),
              lastSyncAt: Type.String({ format: 'date-time' }),
              touchedAt: Type.String({ format: 'date-time' }),
              notes: Type.String(),
              favorite: Type.Boolean(),
              archived: Type.Boolean(),
              pinned: Type.Boolean(),
              score: Type.Integer(),
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
  { $id: 'Project' }
)

export const ProjectSelect = Type.Partial(
  Type.Object(
    {
      id: Type.Boolean(),
      githubId: Type.Boolean(),
      name: Type.Boolean(),
      fullName: Type.Boolean(),
      url: Type.Boolean(),
      description: Type.Boolean(),
      language: Type.Boolean(),
      stars: Type.Boolean(),
      forks: Type.Boolean(),
      lastCommit: Type.Boolean(),
      lastSyncAt: Type.Boolean(),
      touchedAt: Type.Boolean(),
      notes: Type.Boolean(),
      favorite: Type.Boolean(),
      archived: Type.Boolean(),
      pinned: Type.Boolean(),
      score: Type.Boolean(),
      videoLinks: Type.Boolean(),
      tags: Type.Boolean(),
      createdAt: Type.Boolean(),
      updatedAt: Type.Boolean(),
      deletedAt: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false }
  )
)

export const ProjectInclude = Type.Partial(
  Type.Object(
    {
      videoLinks: Type.Boolean(),
      tags: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false }
  )
)

export const ProjectOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      githubId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      name: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      fullName: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      url: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      description: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      language: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      stars: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      forks: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      lastCommit: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      lastSyncAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      touchedAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      notes: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      favorite: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      archived: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      pinned: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      score: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
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

export const Project = Type.Composite([ProjectPlain, ProjectRelations], {
  additionalProperties: false,
})
