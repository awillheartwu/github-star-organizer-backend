import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const UserPlain = Type.Object(
  {
    id: Type.String(),
    email: Type.String(),
    passwordHash: Type.String(),
    displayName: __nullable__(Type.String()),
    role: Type.Union([Type.Literal("USER"), Type.Literal("ADMIN")], {
      additionalProperties: false,
    }),
    tokenVersion: Type.Integer(),
    createdAt: Type.String({ format: "date-time" }),
    updatedAt: Type.String({ format: "date-time" }),
  },
  { additionalProperties: false },
);

export const UserRelations = Type.Object(
  {
    refreshTokens: Type.Array(
      Type.Object(
        {
          id: Type.String(),
          userId: Type.String(),
          tokenHash: Type.String(),
          jti: Type.String(),
          revoked: Type.Boolean(),
          replacedByTokenId: __nullable__(Type.String()),
          expiresAt: Type.String({ format: "date-time" }),
          createdAt: Type.String({ format: "date-time" }),
          ip: __nullable__(Type.String()),
          userAgent: __nullable__(Type.String()),
        },
        { additionalProperties: false },
      ),
      { additionalProperties: false },
    ),
  },
  { additionalProperties: false },
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
          id: Type.String(),
          email: Type.String(),
          passwordHash: Type.String(),
          displayName: Type.String(),
          role: Type.Union([Type.Literal("USER"), Type.Literal("ADMIN")], {
            additionalProperties: false,
          }),
          tokenVersion: Type.Integer(),
          createdAt: Type.String({ format: "date-time" }),
          updatedAt: Type.String({ format: "date-time" }),
        },
        { additionalProperties: false },
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
            { id: Type.String(), email: Type.String() },
            { additionalProperties: false },
          ),
          { additionalProperties: false },
        ),
        Type.Union(
          [
            Type.Object({ id: Type.String() }),
            Type.Object({ email: Type.String() }),
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
              email: Type.String(),
              passwordHash: Type.String(),
              displayName: Type.String(),
              role: Type.Union([Type.Literal("USER"), Type.Literal("ADMIN")], {
                additionalProperties: false,
              }),
              tokenVersion: Type.Integer(),
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
    { additionalProperties: false },
  ),
);

export const UserInclude = Type.Partial(
  Type.Object(
    {
      role: Type.Boolean(),
      refreshTokens: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false },
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
    { additionalProperties: false },
  ),
);

export const User = Type.Composite([UserPlain, UserRelations], {
  additionalProperties: false,
});
