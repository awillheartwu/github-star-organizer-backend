import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const ProjectTagPlain = Type.Object(
  { projectId: Type.String(), tagId: Type.String() },
  { additionalProperties: false },
);

export const ProjectTagRelations = Type.Object(
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
        lastCommit: __nullable__(Type.String({ format: "date-time" })),
        lastSyncAt: Type.String({ format: "date-time" }),
        touchedAt: __nullable__(Type.String({ format: "date-time" })),
        notes: __nullable__(Type.String()),
        favorite: Type.Boolean(),
        archived: Type.Boolean(),
        pinned: Type.Boolean(),
        score: __nullable__(Type.Integer()),
        createdAt: Type.String({ format: "date-time" }),
        updatedAt: Type.String({ format: "date-time" }),
        deletedAt: __nullable__(Type.String({ format: "date-time" })),
      },
      { additionalProperties: false },
    ),
    tag: Type.Object(
      {
        id: Type.String(),
        name: Type.String(),
        description: __nullable__(Type.String()),
        archived: Type.Boolean(),
        createdAt: Type.String({ format: "date-time" }),
        updatedAt: Type.String({ format: "date-time" }),
        deletedAt: __nullable__(Type.String({ format: "date-time" })),
      },
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const ProjectTagWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([
            Self,
            Type.Array(Self, { additionalProperties: false }),
          ]),
          NOT: Type.Union([
            Self,
            Type.Array(Self, { additionalProperties: false }),
          ]),
          OR: Type.Array(Self, { additionalProperties: false }),
          projectId: Type.String(),
          tagId: Type.String(),
        },
        { additionalProperties: false },
      ),
    { $id: "ProjectTag" },
  ),
);

export const ProjectTagWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(Type.Object({}, { additionalProperties: false }), {
          additionalProperties: false,
        }),
        Type.Union([], { additionalProperties: false }),
        Type.Partial(
          Type.Object({
            AND: Type.Union([
              Self,
              Type.Array(Self, { additionalProperties: false }),
            ]),
            NOT: Type.Union([
              Self,
              Type.Array(Self, { additionalProperties: false }),
            ]),
            OR: Type.Array(Self, { additionalProperties: false }),
          }),
          { additionalProperties: false },
        ),
        Type.Partial(
          Type.Object(
            { projectId: Type.String(), tagId: Type.String() },
            { additionalProperties: false },
          ),
        ),
      ],
      { additionalProperties: false },
    ),
  { $id: "ProjectTag" },
);

export const ProjectTagSelect = Type.Partial(
  Type.Object(
    {
      project: Type.Boolean(),
      projectId: Type.Boolean(),
      tag: Type.Boolean(),
      tagId: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
);

export const ProjectTagInclude = Type.Partial(
  Type.Object(
    { project: Type.Boolean(), tag: Type.Boolean(), _count: Type.Boolean() },
    { additionalProperties: false },
  ),
);

export const ProjectTagOrderBy = Type.Partial(
  Type.Object(
    {
      projectId: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      tagId: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false },
  ),
);

export const ProjectTag = Type.Composite(
  [ProjectTagPlain, ProjectTagRelations],
  { additionalProperties: false },
);
