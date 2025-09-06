import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const RefreshTokenPlain = Type.Object(
  {
    id: Type.String(),
    userId: Type.String({ description: `所属用户` }),
    tokenHash: Type.String({ description: `只存哈希（避免明文落库）` }),
    jti: Type.String(),
    revoked: Type.Boolean({ description: `只存哈希（避免明文落库）` }),
    replacedByTokenId: __nullable__(
      Type.String({ description: `替换的令牌 ID（可选，用于单点登录等）` })
    ),
    expiresAt: Type.String({ format: 'date-time', description: `过期时间` }),
    createdAt: Type.String({ format: 'date-time' }),
    revokedAt: __nullable__(Type.String({ format: 'date-time' })),
    ip: __nullable__(Type.String({ description: `ip 地址与 user-agent（可选，用于审计）` })),
    userAgent: __nullable__(Type.String()),
  },
  { additionalProperties: false, description: `Refresh Token（仅存哈希）` }
)

export const RefreshTokenRelations = Type.Object(
  {
    user: Type.Object(
      {
        id: Type.String({ description: `主键，UUID` }),
        email: Type.String({ description: `用户邮箱` }),
        passwordHash: Type.String({ description: `密码哈希` }),
        displayName: __nullable__(Type.String({ description: `显示名称` })),
        role: Type.Union([Type.Literal('USER'), Type.Literal('ADMIN')], {
          additionalProperties: false,
          description: `用户角色`,
        }),
        tokenVersion: Type.Integer({
          description: `令牌版本（用于刷新令牌的无状态撤销）`,
        }),
        createdAt: Type.String({ format: 'date-time' }),
        updatedAt: Type.String({ format: 'date-time' }),
      },
      { additionalProperties: false, description: `用户表` }
    ),
  },
  { additionalProperties: false, description: `Refresh Token（仅存哈希）` }
)

export const RefreshTokenWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          OR: Type.Array(Self, { additionalProperties: false }),
          id: Type.String(),
          userId: Type.String({ description: `所属用户` }),
          tokenHash: Type.String({ description: `只存哈希（避免明文落库）` }),
          jti: Type.String(),
          revoked: Type.Boolean({ description: `只存哈希（避免明文落库）` }),
          replacedByTokenId: Type.String({
            description: `替换的令牌 ID（可选，用于单点登录等）`,
          }),
          expiresAt: Type.String({
            format: 'date-time',
            description: `过期时间`,
          }),
          createdAt: Type.String({ format: 'date-time' }),
          revokedAt: Type.String({ format: 'date-time' }),
          ip: Type.String({
            description: `ip 地址与 user-agent（可选，用于审计）`,
          }),
          userAgent: Type.String(),
        },
        {
          additionalProperties: false,
          description: `Refresh Token（仅存哈希）`,
        }
      ),
    { $id: 'RefreshToken' }
  )
)

export const RefreshTokenWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            {
              id: Type.String(),
              tokenHash: Type.String({
                description: `只存哈希（避免明文落库）`,
              }),
              jti: Type.String(),
            },
            {
              additionalProperties: false,
              description: `Refresh Token（仅存哈希）`,
            }
          ),
          { additionalProperties: false }
        ),
        Type.Union(
          [
            Type.Object({ id: Type.String() }),
            Type.Object({
              tokenHash: Type.String({
                description: `只存哈希（避免明文落库）`,
              }),
            }),
            Type.Object({ jti: Type.String() }),
          ],
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
              userId: Type.String({ description: `所属用户` }),
              tokenHash: Type.String({
                description: `只存哈希（避免明文落库）`,
              }),
              jti: Type.String(),
              revoked: Type.Boolean({
                description: `只存哈希（避免明文落库）`,
              }),
              replacedByTokenId: Type.String({
                description: `替换的令牌 ID（可选，用于单点登录等）`,
              }),
              expiresAt: Type.String({
                format: 'date-time',
                description: `过期时间`,
              }),
              createdAt: Type.String({ format: 'date-time' }),
              revokedAt: Type.String({ format: 'date-time' }),
              ip: Type.String({
                description: `ip 地址与 user-agent（可选，用于审计）`,
              }),
              userAgent: Type.String(),
            },
            { additionalProperties: false }
          )
        ),
      ],
      { additionalProperties: false }
    ),
  { $id: 'RefreshToken' }
)

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
    { additionalProperties: false, description: `Refresh Token（仅存哈希）` }
  )
)

export const RefreshTokenInclude = Type.Partial(
  Type.Object(
    { user: Type.Boolean(), _count: Type.Boolean() },
    { additionalProperties: false, description: `Refresh Token（仅存哈希）` }
  )
)

export const RefreshTokenOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      userId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      tokenHash: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      jti: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      revoked: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      replacedByTokenId: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      expiresAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      createdAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      revokedAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      ip: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      userAgent: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
    },
    { additionalProperties: false, description: `Refresh Token（仅存哈希）` }
  )
)

export const RefreshToken = Type.Composite([RefreshTokenPlain, RefreshTokenRelations], {
  additionalProperties: false,
})
