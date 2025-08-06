import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const TagPlain = Type.Object(
  {
    id: Type.String(),
    name: Type.String(),
    description: __nullable__(Type.String()),
  },
  { additionalProperties: false },
);

export const TagRelations = Type.Object(
  {
    projects: Type.Array(
      Type.Object(
        { projectId: Type.String(), tagId: Type.String() },
        { additionalProperties: false },
      ),
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
);

export const TagWhere = Type.Partial(
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
          id: Type.String(),
          name: Type.String(),
          description: Type.String(),
        },
        { additionalProperties: false },
      ),
    { $id: "Tag" },
  ),
);

export const TagWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            { id: Type.String(), name: Type.String() },
            { additionalProperties: false },
          ),
          { additionalProperties: false },
        ),
        Type.Union(
          [
            Type.Object({ id: Type.String() }),
            Type.Object({ name: Type.String() }),
          ],
          { additionalProperties: false },
        ),
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
            {
              id: Type.String(),
              name: Type.String(),
              description: Type.String(),
            },
            { additionalProperties: false },
          ),
        ),
      ],
      { additionalProperties: false },
    ),
  { $id: "Tag" },
);

export const TagSelect = Type.Partial(
  Type.Object(
    {
      id: Type.Boolean(),
      name: Type.Boolean(),
      description: Type.Boolean(),
      projects: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
);

export const TagInclude = Type.Partial(
  Type.Object(
    { projects: Type.Boolean(), _count: Type.Boolean() },
    { additionalProperties: false },
  ),
);

export const TagOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      name: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      description: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false },
  ),
);

export const Tag = Type.Composite([TagPlain, TagRelations], {
  additionalProperties: false,
});
