import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const RefreshTokenPlain = Type.Object(
  {
    id: Type.String(),
    userId: Type.String(),
    tokenHash: Type.String(),
    jti: Type.String(),
    revoked: Type.Boolean(),
    replacedByTokenId: __nullable__(Type.String()),
    expiresAt: Type.String({ format: "date-time" }),
    createdAt: Type.String({ format: "date-time" }),
    revokedAt: __nullable__(Type.String({ format: "date-time" })),
    ip: __nullable__(Type.String()),
    userAgent: __nullable__(Type.String()),
  },
  { additionalProperties: false },
);

export const RefreshTokenRelations = Type.Object(
  {
    user: Type.Object(
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
    ),
  },
  { additionalProperties: false },
);

export const RefreshTokenWhere = Type.Partial(
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
          userId: Type.String(),
          tokenHash: Type.String(),
          jti: Type.String(),
          revoked: Type.Boolean(),
          replacedByTokenId: Type.String(),
          expiresAt: Type.String({ format: "date-time" }),
          createdAt: Type.String({ format: "date-time" }),
          revokedAt: Type.String({ format: "date-time" }),
          ip: Type.String(),
          userAgent: Type.String(),
        },
        { additionalProperties: false },
      ),
    { $id: "RefreshToken" },
  ),
);

export const RefreshTokenWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            { id: Type.String(), tokenHash: Type.String(), jti: Type.String() },
            { additionalProperties: false },
          ),
          { additionalProperties: false },
        ),
        Type.Union(
          [
            Type.Object({ id: Type.String() }),
            Type.Object({ tokenHash: Type.String() }),
            Type.Object({ jti: Type.String() }),
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
              userId: Type.String(),
              tokenHash: Type.String(),
              jti: Type.String(),
              revoked: Type.Boolean(),
              replacedByTokenId: Type.String(),
              expiresAt: Type.String({ format: "date-time" }),
              createdAt: Type.String({ format: "date-time" }),
              revokedAt: Type.String({ format: "date-time" }),
              ip: Type.String(),
              userAgent: Type.String(),
            },
            { additionalProperties: false },
          ),
        ),
      ],
      { additionalProperties: false },
    ),
  { $id: "RefreshToken" },
);

export const RefreshTokenSelect = Type.Partial(
  Type.Object(
    {
      id: Type.Boolean(),
      userId: Type.Boolean(),
      user: Type.Boolean(),
      tokenHash: Type.Boolean(),
      jti: Type.Boolean(),
      revoked: Type.Boolean(),
      replacedByTokenId: Type.Boolean(),
      expiresAt: Type.Boolean(),
      createdAt: Type.Boolean(),
      revokedAt: Type.Boolean(),
      ip: Type.Boolean(),
      userAgent: Type.Boolean(),
      _count: Type.Boolean(),
    },
    { additionalProperties: false },
  ),
);

export const RefreshTokenInclude = Type.Partial(
  Type.Object(
    { user: Type.Boolean(), _count: Type.Boolean() },
    { additionalProperties: false },
  ),
);

export const RefreshTokenOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      userId: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      tokenHash: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      jti: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      revoked: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      replacedByTokenId: Type.Union(
        [Type.Literal("asc"), Type.Literal("desc")],
        { additionalProperties: false },
      ),
      expiresAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      createdAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      revokedAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      ip: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      userAgent: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false },
  ),
);

export const RefreshToken = Type.Composite(
  [RefreshTokenPlain, RefreshTokenRelations],
  { additionalProperties: false },
);
