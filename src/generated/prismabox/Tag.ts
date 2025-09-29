import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const TagPlain = Type.Object(
  {
    id: Type.String({ description: `主键，UUID` }),
    name: Type.String({ description: `标签名称（不再唯一，靠软删区分）` }),
    description: __nullable__(Type.String({ description: `标签描述（可选）` })),
    archived: Type.Boolean({ description: `是否归档` }),
    createdAt: Type.String({ format: "date-time", description: `创建时间` }),
    updatedAt: Type.String({
      format: "date-time",
      description: `更新时间（自动更新）`,
    }),
    deletedAt: __nullable__(
      Type.String({ format: "date-time", description: `软删除时间（可选）` }),
    ),
  },
  { additionalProperties: false, description: `标签表` },
);

export const TagRelations = Type.Object(
  {
    projects: Type.Array(
      Type.Object(
        { projectId: Type.String(), tagId: Type.String() },
        { additionalProperties: false, description: `项目-标签 关联表` },
      ),
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, description: `标签表` },
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
          id: Type.String({ description: `主键，UUID` }),
          name: Type.String({
            description: `标签名称（不再唯一，靠软删区分）`,
          }),
          description: Type.String({ description: `标签描述（可选）` }),
          archived: Type.Boolean({ description: `是否归档` }),
          createdAt: Type.String({
            format: "date-time",
            description: `创建时间`,
          }),
          updatedAt: Type.String({
            format: "date-time",
            description: `更新时间（自动更新）`,
          }),
          deletedAt: Type.String({
            format: "date-time",
            description: `软删除时间（可选）`,
          }),
        },
        { additionalProperties: false, description: `标签表` },
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
            { id: Type.String({ description: `主键，UUID` }) },
            { additionalProperties: false, description: `标签表` },
          ),
          { additionalProperties: false },
        ),
        Type.Union(
          [Type.Object({ id: Type.String({ description: `主键，UUID` }) })],
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
              id: Type.String({ description: `主键，UUID` }),
              name: Type.String({
                description: `标签名称（不再唯一，靠软删区分）`,
              }),
              description: Type.String({ description: `标签描述（可选）` }),
              archived: Type.Boolean({ description: `是否归档` }),
              createdAt: Type.String({
                format: "date-time",
                description: `创建时间`,
              }),
              updatedAt: Type.String({
                format: "date-time",
                description: `更新时间（自动更新）`,
              }),
              deletedAt: Type.String({
                format: "date-time",
                description: `软删除时间（可选）`,
              }),
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
      archived: Type.Boolean(),
      createdAt: Type.Boolean(),
      updatedAt: Type.Boolean(),
      deletedAt: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false, description: `标签表` },
  ),
);

export const TagInclude = Type.Partial(
  Type.Object(
    { projects: Type.Boolean(), _count: Type.Boolean() },
    { additionalProperties: false, description: `标签表` },
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
      archived: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      createdAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      updatedAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      deletedAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false, description: `标签表` },
  ),
);

export const Tag = Type.Composite([TagPlain, TagRelations], {
  additionalProperties: false,
});
