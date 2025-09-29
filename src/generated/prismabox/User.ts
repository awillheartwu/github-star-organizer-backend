import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const UserPlain = Type.Object(
  {
    id: Type.String({ description: `主键，UUID` }),
    email: Type.String({ description: `用户邮箱` }),
    passwordHash: Type.String({ description: `密码哈希` }),
    displayName: __nullable__(Type.String({ description: `显示名称` })),
    role: Type.Union([Type.Literal("USER"), Type.Literal("ADMIN")], {
      additionalProperties: false,
      description: `用户角色`,
    }),
    tokenVersion: Type.Integer({
      description: `令牌版本（用于刷新令牌的无状态撤销）`,
    }),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false, description: `用户表` },
);

export const UserRelations = Type.Object(
  {
    refreshTokens: Type.Array(
      Type.Object(
        {
          id: Type.String(),
          userId: Type.String({ description: `所属用户` }),
          tokenHash: Type.String({ description: `只存哈希（避免明文落库）` }),
          jti: Type.String(),
          revoked: Type.Boolean({ description: `只存哈希（避免明文落库）` }),
          replacedByTokenId: __nullable__(
            Type.String({
              description: `替换的令牌 ID（可选，用于单点登录等）`,
            }),
          ),
          expiresAt: Type.String({
            format: "date-time",
            description: `过期时间`,
          }),
          createdAt: Type.String({ format: "date-time" }),
          revokedAt: __nullable__(Type.String({ format: "date-time" })),
          ip: __nullable__(
            Type.String({
              description: `ip 地址与 user-agent（可选，用于审计）`,
            }),
          ),
          userAgent: __nullable__(Type.String()),
        },
        {
          additionalProperties: false,
          description: `Refresh Token（仅存哈希）`,
        },
      ),
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false, description: `用户表` },
);

export const UserWhere = Type.Partial(
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
          email: Type.String({ description: `用户邮箱` }),
          passwordHash: Type.String({ description: `密码哈希` }),
          displayName: Type.String({ description: `显示名称` }),
          role: Type.Union([Type.Literal("USER"), Type.Literal("ADMIN")], {
            additionalProperties: false,
            description: `用户角色`,
          }),
          tokenVersion: Type.Integer({
            description: `令牌版本（用于刷新令牌的无状态撤销）`,
          }),
          createdAt: Type.String({ format: "date-time" }),
          updatedAt: Type.String({ format: "date-time" }),
        },
        { additionalProperties: false, description: `用户表` },
      ),
    { $id: "User" },
  ),
);

export const UserWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            {
              id: Type.String({ description: `主键，UUID` }),
              email: Type.String({ description: `用户邮箱` }),
            },
            { additionalProperties: false, description: `用户表` },
          ),
          { additionalProperties: false },
        ),
        Type.Union(
          [
            Type.Object({ id: Type.String({ description: `主键，UUID` }) }),
            Type.Object({ email: Type.String({ description: `用户邮箱` }) }),
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
              id: Type.String({ description: `主键，UUID` }),
              email: Type.String({ description: `用户邮箱` }),
              passwordHash: Type.String({ description: `密码哈希` }),
              displayName: Type.String({ description: `显示名称` }),
              role: Type.Union([Type.Literal("USER"), Type.Literal("ADMIN")], {
                additionalProperties: false,
                description: `用户角色`,
              }),
              tokenVersion: Type.Integer({
                description: `令牌版本（用于刷新令牌的无状态撤销）`,
              }),
              createdAt: Type.String({ format: "date-time" }),
              updatedAt: Type.String({ format: "date-time" }),
            },
            { additionalProperties: false },
          ),
        ),
      ],
      { additionalProperties: false },
    ),
  { $id: "User" },
);

export const UserSelect = Type.Partial(
  Type.Object(
    {
      id: Type.Boolean(),
      email: Type.Boolean(),
      passwordHash: Type.Boolean(),
      displayName: Type.Boolean(),
      role: Type.Boolean(),
      tokenVersion: Type.Boolean(),
      createdAt: Type.Boolean(),
      updatedAt: Type.Boolean(),
      refreshTokens: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false, description: `用户表` },
  ),
);

export const UserInclude = Type.Partial(
  Type.Object(
    {
      role: Type.Boolean(),
      refreshTokens: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false, description: `用户表` },
  ),
);

export const UserOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      email: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      passwordHash: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      displayName: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      tokenVersion: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      createdAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      updatedAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false, description: `用户表` },
  ),
);

export const User = Type.Composite([UserPlain, UserRelations], {
  additionalProperties: false,
});
