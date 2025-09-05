import { Type } from '@sinclair/typebox'

import { __transformDate__ } from './__transformDate__'

import { __nullable__ } from './__nullable__'

export const SyncStatePlain = Type.Object(
  {
    id: Type.String(),
    source: Type.String({ description: `同步来源：例如 'github:stars'` }),
    key: Type.String({
      description: `任务键：例如 'user:YOUR_GITHUB_USERNAME'`,
    }),
    cursor: __nullable__(
      Type.String({
        description: `用于增量同步的游标（例如 GitHub starred_at 的 ISO 字符串）`,
      })
    ),
    etag: __nullable__(Type.String({ description: `HTTP ETag（If-None-Match/304），可选加速` })),
    lastRunAt: __nullable__(
      Type.String({
        format: 'date-time',
        description: `最近一次运行时间/成功时间/失败时间`,
      })
    ),
    lastSuccessAt: __nullable__(Type.String({ format: 'date-time' })),
    lastErrorAt: __nullable__(Type.String({ format: 'date-time' })),
    lastError: __nullable__(Type.String({ description: `最近一次错误信息（简要）` })),
    statsJson: __nullable__(
      Type.String({
        description: `最近一次统计信息（JSON 串，记录 created/updated 等）`,
      })
    ),
    createdAt: Type.String({ format: 'date-time' }),
    updatedAt: Type.String({ format: 'date-time' }),
  },
  {
    additionalProperties: false,
    description: `记录各类同步任务的游标与状态
兼容多来源与多任务，通过 (source, key) 唯一定位。`,
  }
)

export const SyncStateRelations = Type.Object(
  {},
  {
    additionalProperties: false,
    description: `记录各类同步任务的游标与状态
兼容多来源与多任务，通过 (source, key) 唯一定位。`,
  }
)

export const SyncStateWhere = Type.Partial(
  Type.Recursive(
    (Self) =>
      Type.Object(
        {
          AND: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          NOT: Type.Union([Self, Type.Array(Self, { additionalProperties: false })]),
          OR: Type.Array(Self, { additionalProperties: false }),
          id: Type.String(),
          source: Type.String({ description: `同步来源：例如 'github:stars'` }),
          key: Type.String({
            description: `任务键：例如 'user:YOUR_GITHUB_USERNAME'`,
          }),
          cursor: Type.String({
            description: `用于增量同步的游标（例如 GitHub starred_at 的 ISO 字符串）`,
          }),
          etag: Type.String({
            description: `HTTP ETag（If-None-Match/304），可选加速`,
          }),
          lastRunAt: Type.String({
            format: 'date-time',
            description: `最近一次运行时间/成功时间/失败时间`,
          }),
          lastSuccessAt: Type.String({ format: 'date-time' }),
          lastErrorAt: Type.String({ format: 'date-time' }),
          lastError: Type.String({ description: `最近一次错误信息（简要）` }),
          statsJson: Type.String({
            description: `最近一次统计信息（JSON 串，记录 created/updated 等）`,
          }),
          createdAt: Type.String({ format: 'date-time' }),
          updatedAt: Type.String({ format: 'date-time' }),
        },
        {
          additionalProperties: false,
          description: `记录各类同步任务的游标与状态
兼容多来源与多任务，通过 (source, key) 唯一定位。`,
        }
      ),
    { $id: 'SyncState' }
  )
)

export const SyncStateWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            {
              id: Type.String(),
              source_key: Type.Object(
                {
                  source: Type.String({
                    description: `同步来源：例如 'github:stars'`,
                  }),
                  key: Type.String({
                    description: `任务键：例如 'user:YOUR_GITHUB_USERNAME'`,
                  }),
                },
                { additionalProperties: false }
              ),
            },
            {
              additionalProperties: false,
              description: `记录各类同步任务的游标与状态
兼容多来源与多任务，通过 (source, key) 唯一定位。`,
            }
          ),
          { additionalProperties: false }
        ),
        Type.Union(
          [
            Type.Object({ id: Type.String() }),
            Type.Object({
              source_key: Type.Object(
                {
                  source: Type.String({
                    description: `同步来源：例如 'github:stars'`,
                  }),
                  key: Type.String({
                    description: `任务键：例如 'user:YOUR_GITHUB_USERNAME'`,
                  }),
                },
                { additionalProperties: false }
              ),
            }),
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
              source: Type.String({
                description: `同步来源：例如 'github:stars'`,
              }),
              key: Type.String({
                description: `任务键：例如 'user:YOUR_GITHUB_USERNAME'`,
              }),
              cursor: Type.String({
                description: `用于增量同步的游标（例如 GitHub starred_at 的 ISO 字符串）`,
              }),
              etag: Type.String({
                description: `HTTP ETag（If-None-Match/304），可选加速`,
              }),
              lastRunAt: Type.String({
                format: 'date-time',
                description: `最近一次运行时间/成功时间/失败时间`,
              }),
              lastSuccessAt: Type.String({ format: 'date-time' }),
              lastErrorAt: Type.String({ format: 'date-time' }),
              lastError: Type.String({
                description: `最近一次错误信息（简要）`,
              }),
              statsJson: Type.String({
                description: `最近一次统计信息（JSON 串，记录 created/updated 等）`,
              }),
              createdAt: Type.String({ format: 'date-time' }),
              updatedAt: Type.String({ format: 'date-time' }),
            },
            { additionalProperties: false }
          )
        ),
      ],
      { additionalProperties: false }
    ),
  { $id: 'SyncState' }
)

export const SyncStateSelect = Type.Partial(
  Type.Object(
    {
      id: Type.Boolean(),
      source: Type.Boolean(),
      key: Type.Boolean(),
      cursor: Type.Boolean(),
      etag: Type.Boolean(),
      lastRunAt: Type.Boolean(),
      lastSuccessAt: Type.Boolean(),
      lastErrorAt: Type.Boolean(),
      lastError: Type.Boolean(),
      statsJson: Type.Boolean(),
      createdAt: Type.Boolean(),
      updatedAt: Type.Boolean(),
      _count: Type.Boolean(),
    },
    {
      additionalProperties: false,
      description: `记录各类同步任务的游标与状态
兼容多来源与多任务，通过 (source, key) 唯一定位。`,
    }
  )
)

export const SyncStateInclude = Type.Partial(
  Type.Object(
    { _count: Type.Boolean() },
    {
      additionalProperties: false,
      description: `记录各类同步任务的游标与状态
兼容多来源与多任务，通过 (source, key) 唯一定位。`,
    }
  )
)

export const SyncStateOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      source: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      key: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      cursor: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      etag: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      lastRunAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      lastSuccessAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      lastErrorAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      lastError: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      statsJson: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      createdAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
      updatedAt: Type.Union([Type.Literal('asc'), Type.Literal('desc')], {
        additionalProperties: false,
      }),
    },
    {
      additionalProperties: false,
      description: `记录各类同步任务的游标与状态
兼容多来源与多任务，通过 (source, key) 唯一定位。`,
    }
  )
)

export const SyncState = Type.Composite([SyncStatePlain, SyncStateRelations], {
  additionalProperties: false,
})
