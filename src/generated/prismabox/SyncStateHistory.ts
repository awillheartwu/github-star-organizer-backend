import { Type } from "@sinclair/typebox";

import { __transformDate__ } from "./__transformDate__";

import { __nullable__ } from "./__nullable__";

export const SyncStateHistoryPlain = Type.Object(
  {
    id: Type.String(),
    source: Type.String({ description: `同步来源：例如 'github:stars'` }),
    key: Type.String({
      description: `任务键：例如 'user:YOUR_GITHUB_USERNAME'`,
    }),
    cursor: __nullable__(
      Type.String({
        description: `用于增量同步的游标（例如 GitHub starred_at 的 ISO 字符串）`,
      }),
    ),
    etag: __nullable__(
      Type.String({ description: `HTTP ETag（If-None-Match/304），可选加速` }),
    ),
    lastRunAt: __nullable__(
      Type.String({
        format: "date-time",
        description: `本次运行时间/成功时间/失败时间`,
      }),
    ),
    lastSuccessAt: __nullable__(Type.String({ format: "date-time" })),
    lastErrorAt: __nullable__(Type.String({ format: "date-time" })),
    lastError: __nullable__(
      Type.String({ description: `本次错误信息（简要）` }),
    ),
    statsJson: __nullable__(
      Type.String({
        description: `本次统计信息（JSON 串，记录 created/updated 等）`,
      }),
    ),
    createdAt: Type.String({ format: "date-time" }),
  },
  {
    additionalProperties: false,
    description: `同步/任务运行历史（每次运行一条）`,
  },
);

export const SyncStateHistoryRelations = Type.Object(
  {},
  {
    additionalProperties: false,
    description: `同步/任务运行历史（每次运行一条）`,
  },
);

export const SyncStateHistoryWhere = Type.Partial(
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
            format: "date-time",
            description: `本次运行时间/成功时间/失败时间`,
          }),
          lastSuccessAt: Type.String({ format: "date-time" }),
          lastErrorAt: Type.String({ format: "date-time" }),
          lastError: Type.String({ description: `本次错误信息（简要）` }),
          statsJson: Type.String({
            description: `本次统计信息（JSON 串，记录 created/updated 等）`,
          }),
          createdAt: Type.String({ format: "date-time" }),
        },
        {
          additionalProperties: false,
          description: `同步/任务运行历史（每次运行一条）`,
        },
      ),
    { $id: "SyncStateHistory" },
  ),
);

export const SyncStateHistoryWhereUnique = Type.Recursive(
  (Self) =>
    Type.Intersect(
      [
        Type.Partial(
          Type.Object(
            { id: Type.String() },
            {
              additionalProperties: false,
              description: `同步/任务运行历史（每次运行一条）`,
            },
          ),
          { additionalProperties: false },
        ),
        Type.Union([Type.Object({ id: Type.String() })], {
          additionalProperties: false,
        }),
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
                format: "date-time",
                description: `本次运行时间/成功时间/失败时间`,
              }),
              lastSuccessAt: Type.String({ format: "date-time" }),
              lastErrorAt: Type.String({ format: "date-time" }),
              lastError: Type.String({ description: `本次错误信息（简要）` }),
              statsJson: Type.String({
                description: `本次统计信息（JSON 串，记录 created/updated 等）`,
              }),
              createdAt: Type.String({ format: "date-time" }),
            },
            { additionalProperties: false },
          ),
        ),
      ],
      { additionalProperties: false },
    ),
  { $id: "SyncStateHistory" },
);

export const SyncStateHistorySelect = Type.Partial(
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
      _count: Type.Boolean(),
    },
    {
      additionalProperties: false,
      description: `同步/任务运行历史（每次运行一条）`,
    },
  ),
);

export const SyncStateHistoryInclude = Type.Partial(
  Type.Object(
    { _count: Type.Boolean() },
    {
      additionalProperties: false,
      description: `同步/任务运行历史（每次运行一条）`,
    },
  ),
);

export const SyncStateHistoryOrderBy = Type.Partial(
  Type.Object(
    {
      id: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      source: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      key: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      cursor: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      etag: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      lastRunAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      lastSuccessAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      lastErrorAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      lastError: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      statsJson: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
      createdAt: Type.Union([Type.Literal("asc"), Type.Literal("desc")], {
        additionalProperties: false,
      }),
    },
    {
      additionalProperties: false,
      description: `同步/任务运行历史（每次运行一条）`,
    },
  ),
);

export const SyncStateHistory = Type.Composite(
  [SyncStateHistoryPlain, SyncStateHistoryRelations],
  { additionalProperties: false },
);
