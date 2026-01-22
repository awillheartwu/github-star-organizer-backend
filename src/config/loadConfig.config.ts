import path from 'node:path'
import { config as dotenv } from 'dotenv'
import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

/**
 * 环境变量原始 Schema（运行时从 process.env 读取的字符串集合）。
 *
 * - 该 Schema 仅用于“解析 + 校验 + 注释导出”（scripts/export-config-doc.ts）。
 * - 实际业务请通过下方 `loadConfig()` 得到强类型的 `AppConfig` 使用。
 */

// 1) 选择加载哪个 .env：先加载基础的 .env，然后加载特定环境的覆盖文件
function loadDotenvFiles() {
  // Load base .env if present
  dotenv({ path: path.resolve(process.cwd(), '.env') })
  // Decide environment file to overlay
  const env = process.env.NODE_ENV ?? 'development'
  const envFile = `.env.${env}`
  dotenv({ path: path.resolve(process.cwd(), envFile), override: true })
}

// 2) 描述和验证原始环境变量
export const EnvSchema = Type.Object(
  {
    NODE_ENV: Type.Union(
      [Type.Literal('development'), Type.Literal('production'), Type.Literal('test')],
      {
        default: 'development',
      }
    ),
    PORT: Type.Number({ default: 3000 }),
    HOST: Type.String({ default: '0.0.0.0' }),
    FASTIFY_CLOSE_GRACE_DELAY: Type.String({ default: '500' }), // ms
    LOG_LEVEL: Type.Union(
      [
        Type.Literal('fatal'),
        Type.Literal('error'),
        Type.Literal('warn'),
        Type.Literal('info'),
        Type.Literal('debug'),
        Type.Literal('trace'),
        Type.Literal('silent'),
      ],
      { default: 'info' }
    ),
    DATABASE_URL: Type.String({ description: 'PostgreSQL connection string' }),
    AI_API_KEY: Type.Optional(Type.String({ description: 'AI 提供商 API Key（DeepSeek 等）' })),
    AI_MODEL: Type.Optional(
      Type.String({ default: 'deepseek-chat', description: 'AI 模型名称，如 deepseek-chat' })
    ),
    AI_TEMPERATURE: Type.Optional(
      Type.Number({ default: 0.3, description: 'AI 采样温度（0~1），越大越发散' })
    ),
    // AI 摘要队列相关
    AI_SUMMARY_CONCURRENCY: Type.Optional(
      Type.Number({ default: 1, description: 'AI 摘要任务并发（worker）' })
    ),
    AI_SUMMARY_LIMIT: Type.Optional(
      Type.Number({ default: 100, description: 'AI 摘要批量扫描默认数量（1-800）' })
    ),
    AI_SUMMARY_CRON: Type.Optional(
      Type.String({ description: 'AI 摘要批量扫描定时表达式（可空）' })
    ),
    AI_SUMMARY_STALE_DAYS: Type.Optional(
      Type.Number({ default: 365, description: 'AI 摘要过期天数（TTL）' })
    ),
    AI_README_MAX_CHARS: Type.Optional(
      Type.Number({ default: 4000, description: '读取 README 片段最大字符数' })
    ),
    AI_RPM_LIMIT: Type.Optional(
      Type.Number({ description: 'AI 提供商每分钟请求上限（可空表示不限制）' })
    ),
    // cors相关
    CORS_ORIGIN: Type.Optional(Type.String({ default: '*' })), // 允许的 origin，多个可用逗号分隔
    CORS_CREDENTIALS: Type.Optional(Type.Boolean({ default: false })),
    TRUST_PROXY: Type.Optional(Type.Boolean({ default: false })),
    BODY_LIMIT: Type.Optional(Type.Number({ default: 1048576 })), // 1MB
    HELMET_CSP: Type.Optional(Type.Boolean({ default: true })), // 是否启用 CSP
    // auth 相关
    JWT_ACCESS_SECRET: Type.String({ description: 'Access Token 签名密钥（保密）' }),
    JWT_REFRESH_SECRET: Type.String({ description: 'Refresh Token 签名密钥（保密）' }),
    JWT_ACCESS_EXPIRES: Type.String({ default: '15m', description: 'AT 过期时间，如 15m/1h' }),
    JWT_REFRESH_EXPIRES: Type.String({ default: '30d', description: 'RT 过期时间，如 30d' }),

    AUTH_COOKIE_NAME: Type.String({ default: 'rt', description: 'Refresh Token Cookie 名称' }),
    AUTH_COOKIE_DOMAIN: Type.Optional(Type.String({ description: 'Refresh Token Cookie 域名' })), // 可为空
    AUTH_COOKIE_SECURE: Type.Boolean({
      default: false,
      description: 'Refresh Token Cookie 是否安全',
    }),
    AUTH_COOKIE_SAME_SITE: Type.Union(
      [Type.Literal('lax'), Type.Literal('strict'), Type.Literal('none')],
      { default: 'lax' }
    ),

    AUTH_ALLOW_REGISTRATION: Type.Boolean({ default: true, description: '是否允许注册新用户' }),

    // 可选：限流
    RATE_LIMIT_WINDOW: Type.Optional(
      Type.Number({ default: 60000, description: '限流窗口时间（毫秒）' })
    ), // ms
    RATE_LIMIT_MAX: Type.Optional(Type.Number({ default: 20, description: '限流最大请求数' })),

    // 放在 EnvSchema 的对象里（保持风格一致）
    REDIS_HOST: Type.String({ description: 'Redis 主机地址' }),
    REDIS_PORT: Type.Number({ default: 6379, description: 'Redis 端口' }),
    REDIS_PASSWORD: Type.String({ description: 'Redis 密码' }),
    BULL_PREFIX: Type.String({ default: 'gsor', description: 'BullMQ key 前缀' }),
    BULL_ROLE: Type.Union(
      [Type.Literal('both'), Type.Literal('worker'), Type.Literal('producer')],
      { default: 'both', description: 'BullMQ 角色：both/worker/producer' }
    ),

    // 同步任务参数
    GITHUB_TOKEN: Type.Optional(Type.String({ description: 'GitHub Personal Access Token' })),
    GITHUB_USERNAME: Type.String({ description: '要同步其 stars 的 GitHub 用户名' }),

    SYNC_STARS_CRON: Type.Optional(
      Type.String({ default: '0 5 * * *', description: 'stars 同步 cron 表达式（每天 05:00）' })
    ),
    SYNC_CONCURRENCY: Type.Optional(Type.Number({ default: 2, description: 'BullMQ worker 并发' })),
    SYNC_JOB_ATTEMPTS: Type.Optional(Type.Number({ default: 3, description: '重试次数' })),
    SYNC_JOB_BACKOFF_MS: Type.Optional(
      Type.Number({ default: 30000, description: '失败后退避时间（毫秒）' })
    ),
    SYNC_PER_PAGE: Type.Optional(Type.Number({ default: 50, description: '每页抓取大小' })),
    SYNC_MAX_PAGES: Type.Optional(Type.Number({ default: 0, description: '最大页数，0 表示无限' })),
    SYNC_SOFT_DELETE_UNSTARRED: Type.Optional(
      Type.Boolean({ default: false, description: '全量末页未出现的项目是否归档删除' })
    ),
    SYNC_REQUEST_TIMEOUT: Type.Optional(
      Type.Number({ default: 15000, description: 'GitHub 请求超时（毫秒）' })
    ),
    // 邮件通知（可选）
    NOTIFY_EMAIL_ENABLED: Type.Optional(
      Type.Boolean({ default: false, description: '启用邮件通知（同步/维护）' })
    ),
    SMTP_HOST: Type.Optional(Type.String({ description: 'SMTP 主机' })),
    SMTP_PORT: Type.Optional(Type.Number({ default: 465, description: 'SMTP 端口' })),
    SMTP_SECURE: Type.Optional(Type.Boolean({ default: true, description: 'SMTP TLS' })),
    SMTP_USER: Type.Optional(Type.String({ description: 'SMTP 用户名' })),
    SMTP_PASS: Type.Optional(Type.String({ description: 'SMTP 授权码/密码' })),
    MAIL_FROM: Type.Optional(Type.String({ description: '邮件 From 显示' })),
    MAIL_TO: Type.Optional(Type.String({ description: '通知收件人，逗号分隔' })),

    // 新版：更细粒度的 RT 清理参数
    RT_EXPIRED_CLEAN_AFTER_DAYS: Type.Optional(
      Type.Number({ default: 0, description: '过期 RT 保留天数（0 立即清理）' })
    ),
    RT_REVOKED_RETENTION_DAYS: Type.Optional(
      Type.Number({ default: 7, description: '吊销 RT 审计保留天数' })
    ),
    RT_CLEAN_BATCH: Type.Optional(Type.Number({ default: 1000, description: '清理批次大小' })),
    RT_CLEAN_DRY_RUN: Type.Optional(Type.Boolean({ default: true, description: '仅预览' })),

    // BullMQ 清理参数（可选）
    BULL_DRY_RUN: Type.Optional(Type.Boolean({ default: true, description: 'Bull 清理仅预览' })),
    BULL_CLEAN_COMPLETED_AFTER_DAYS: Type.Optional(
      Type.Number({ default: 3, description: '清理已完成任务（天）' })
    ),
    BULL_CLEAN_FAILED_AFTER_DAYS: Type.Optional(
      Type.Number({ default: 30, description: '清理失败任务（天）' })
    ),
    BULL_TRIM_EVENTS: Type.Optional(Type.Number({ default: 1000, description: '保留事件条数' })),

    // Bull Board（队列可视化）
    BULL_UI_ENABLED: Type.Optional(
      Type.Boolean({ default: false, description: '开启 Bull Board 可视化界面' })
    ),
    BULL_UI_PATH: Type.Optional(
      Type.String({ default: '/admin/queues/ui', description: 'Bull Board 基础路径' })
    ),
    BULL_UI_READONLY: Type.Optional(
      Type.Boolean({ default: true, description: '仅查看（禁用删除/重试等操作）' })
    ),
    BULL_UI_PUBLIC: Type.Optional(
      Type.Boolean({ default: false, description: '允许无需鉴权访问 Bull Board' })
    ),

    // 维护任务（repeatable job）
    MAINT_ENABLED: Type.Optional(Type.Boolean({ default: true, description: '开启日常维护' })),
    MAINT_CRON: Type.Optional(
      Type.String({ default: '0 3 * * *', description: '维护任务 cron（默认 03:00）' })
    ),
  },

  { additionalProperties: false }
)

type Env = Static<typeof EnvSchema>

// 3) 应用配置的形状暴露给代码库的其余部分
/**
 * 应用内部使用的强类型配置 Schema（经 `loadConfig()` 转换/归一后的形状）。
 *
 * - 与 `EnvSchema` 一一映射，但数值/布尔等已被转换为正确类型。
 * - 该 Schema 也被用于导出文档（scripts/export-config-doc.ts）。
 */
export const AppConfigSchema = Type.Object(
  {
    env: Type.Union([
      Type.Literal('development'),
      Type.Literal('production'),
      Type.Literal('test'),
    ]),
    port: Type.Number(),
    host: Type.String(),
    fastifyCloseGraceDelay: Type.String({ default: '500' }), // ms
    logLevel: Type.Union([
      Type.Literal('fatal'),
      Type.Literal('error'),
      Type.Literal('warn'),
      Type.Literal('info'),
      Type.Literal('debug'),
      Type.Literal('trace'),
      Type.Literal('silent'),
    ]),
    databaseUrl: Type.String(),
    githubToken: Type.Optional(Type.String()),
    aiApiKey: Type.Optional(Type.String()),
    aiModel: Type.Optional(Type.String()),
    aiTemperature: Type.Optional(Type.Number()),
    aiSummaryConcurrency: Type.Optional(Type.Number()),
    aiSummaryLimit: Type.Number(),
    aiSummaryCron: Type.Optional(Type.String()),
    aiSummaryStaleDays: Type.Optional(Type.Number()),
    aiReadmeMaxChars: Type.Optional(Type.Number()),
    aiRpmLimit: Type.Optional(Type.Number()),
    corsOrigin: Type.String(),
    corsCredentials: Type.Boolean(),
    trustProxy: Type.Boolean(),
    bodyLimit: Type.Number(),
    helmetCsp: Type.Boolean(),
    jwtAccessSecret: Type.String(),
    jwtRefreshSecret: Type.String(),
    jwtAccessExpires: Type.String(),
    jwtRefreshExpires: Type.String(),

    authCookieName: Type.String(),
    authCookieDomain: Type.Optional(Type.String()),
    authCookieSecure: Type.Boolean(),
    authCookieSameSite: Type.Union([
      Type.Literal('lax'),
      Type.Literal('strict'),
      Type.Literal('none'),
    ]),
    authAllowRegistration: Type.Boolean(),

    rateLimitWindow: Type.Optional(Type.Number()), // ms
    rateLimitMax: Type.Optional(Type.Number()),

    redisHost: Type.String({}),
    redisPort: Type.Number({ default: 6379 }),
    redisPassword: Type.String({}),
    bullPrefix: Type.String(),
    bullRole: Type.Union([Type.Literal('both'), Type.Literal('worker'), Type.Literal('producer')]),

    githubUsername: Type.String(),
    syncStarsCron: Type.Optional(Type.String()),
    syncConcurrency: Type.Optional(Type.Number()),
    syncJobAttempts: Type.Optional(Type.Number()),
    syncJobBackoffMs: Type.Optional(Type.Number()),
    syncPerPage: Type.Optional(Type.Number()),
    syncMaxPages: Type.Optional(Type.Number()),
    syncSoftDeleteUnstarred: Type.Optional(Type.Boolean()),
    syncRequestTimeout: Type.Optional(Type.Number()),
    // 邮件
    notifyEmailEnabled: Type.Optional(Type.Boolean()),
    smtpHost: Type.Optional(Type.String()),
    smtpPort: Type.Optional(Type.Number()),
    smtpSecure: Type.Optional(Type.Boolean()),
    smtpUser: Type.Optional(Type.String()),
    smtpPass: Type.Optional(Type.String()),
    mailFrom: Type.Optional(Type.String()),
    mailTo: Type.Optional(Type.String()),

    // 新增：细粒度 RT 清理（供 service/script 使用）
    rtExpiredCleanAfterDays: Type.Number(),
    rtRevokedRetentionDays: Type.Number(),
    rtCleanBatch: Type.Number(),
    rtCleanDryRun: Type.Boolean(),

    // BullMQ 清理（供 service/script 使用）
    bullCleanDryRun: Type.Boolean(),
    bullCleanCompletedAfterDays: Type.Number(),
    bullCleanFailedAfterDays: Type.Number(),
    bullTrimEvents: Type.Number(),

    // Bull Board UI
    bullUiEnabled: Type.Optional(Type.Boolean()),
    bullUiPath: Type.Optional(Type.String()),
    bullUiReadOnly: Type.Optional(Type.Boolean()),
    bullUiPublic: Type.Optional(Type.Boolean()),

    // 维护任务开关/时间
    maintEnabled: Type.Boolean(),
    maintCron: Type.String(),
  },
  { additionalProperties: false }
)
/** 应用配置的 TypeScript 类型（供业务层引用）。 */
export type AppConfig = Static<typeof AppConfigSchema>

/**
 * 加载多层 .env，解析并校验，返回只读的 `AppConfig`：
 * 1. 先加载根目录 `.env`，再加载 `.env.${NODE_ENV}` 覆盖。
 * 2. 使用 TypeBox 对 `EnvSchema` 做 Convert+Decode，将字符串转为目标类型。
 * 3. 映射为 `AppConfig` 并断言，最后 `Object.freeze` 防止运行期被改写。
 */
export function loadConfig(): AppConfig {
  // Load .env files
  loadDotenvFiles()

  // Collect raw values (all strings from process.env)
  const raw = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    FASTIFY_CLOSE_GRACE_DELAY: process.env.FASTIFY_CLOSE_GRACE_DELAY,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DATABASE_URL: process.env.DATABASE_URL,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    AI_API_KEY: process.env.AI_API_KEY,
    AI_MODEL: process.env.AI_MODEL,
    AI_TEMPERATURE: process.env.AI_TEMPERATURE,
    AI_SUMMARY_CONCURRENCY: process.env.AI_SUMMARY_CONCURRENCY,
    AI_SUMMARY_LIMIT: process.env.AI_SUMMARY_LIMIT,
    AI_SUMMARY_CRON: process.env.AI_SUMMARY_CRON || undefined,
    AI_SUMMARY_STALE_DAYS: process.env.AI_SUMMARY_STALE_DAYS,
    AI_README_MAX_CHARS: process.env.AI_README_MAX_CHARS,
    AI_RPM_LIMIT: process.env.AI_RPM_LIMIT || undefined,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    CORS_CREDENTIALS: process.env.CORS_CREDENTIALS,
    TRUST_PROXY: process.env.TRUST_PROXY,
    BODY_LIMIT: process.env.BODY_LIMIT,
    HELMET_CSP: process.env.HELMET_CSP,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    JWT_ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES,
    JWT_REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES,
    AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
    AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
    AUTH_COOKIE_SECURE: process.env.AUTH_COOKIE_SECURE,
    AUTH_COOKIE_SAME_SITE: process.env.AUTH_COOKIE_SAME_SITE,
    AUTH_ALLOW_REGISTRATION: process.env.AUTH_ALLOW_REGISTRATION,
    RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW,
    RATE_LIMIT_MAX: process.env.RATE_LIMIT_MAX,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,
    BULL_PREFIX: process.env.BULL_PREFIX,
    BULL_ROLE: process.env.BULL_ROLE,

    GITHUB_USERNAME: process.env.GITHUB_USERNAME,
    SYNC_STARS_CRON: process.env.SYNC_STARS_CRON,
    SYNC_CONCURRENCY: process.env.SYNC_CONCURRENCY,
    SYNC_JOB_ATTEMPTS: process.env.SYNC_JOB_ATTEMPTS,
    SYNC_JOB_BACKOFF_MS: process.env.SYNC_JOB_BACKOFF_MS,
    SYNC_PER_PAGE: process.env.SYNC_PER_PAGE,
    SYNC_MAX_PAGES: process.env.SYNC_MAX_PAGES,
    SYNC_SOFT_DELETE_UNSTARRED: process.env.SYNC_SOFT_DELETE_UNSTARRED,
    SYNC_REQUEST_TIMEOUT: process.env.SYNC_REQUEST_TIMEOUT,
    NOTIFY_EMAIL_ENABLED: process.env.NOTIFY_EMAIL_ENABLED,
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    MAIL_FROM: process.env.MAIL_FROM,
    MAIL_TO: process.env.MAIL_TO,
    RT_EXPIRED_CLEAN_AFTER_DAYS: process.env.RT_EXPIRED_CLEAN_AFTER_DAYS,
    RT_REVOKED_RETENTION_DAYS: process.env.RT_REVOKED_RETENTION_DAYS,
    RT_CLEAN_BATCH: process.env.RT_CLEAN_BATCH,
    RT_CLEAN_DRY_RUN: process.env.RT_CLEAN_DRY_RUN,

    BULL_DRY_RUN: process.env.BULL_DRY_RUN,
    BULL_CLEAN_COMPLETED_AFTER_DAYS: process.env.BULL_CLEAN_COMPLETED_AFTER_DAYS,
    BULL_CLEAN_FAILED_AFTER_DAYS: process.env.BULL_CLEAN_FAILED_AFTER_DAYS,
    BULL_TRIM_EVENTS: process.env.BULL_TRIM_EVENTS,

    BULL_UI_ENABLED: process.env.BULL_UI_ENABLED,
    BULL_UI_PATH: process.env.BULL_UI_PATH,
    BULL_UI_READONLY: process.env.BULL_UI_READONLY,
    BULL_UI_PUBLIC: process.env.BULL_UI_PUBLIC,

    MAINT_ENABLED: process.env.MAINT_ENABLED,
    MAINT_CRON: process.env.MAINT_CRON,
  }

  // Coerce and validate using TypeBox Value tools
  const coerced: Env = Value.Decode(EnvSchema, Value.Convert(EnvSchema, raw))

  const cfg: AppConfig = {
    env: coerced.NODE_ENV,
    port: coerced.PORT,
    host: coerced.HOST,
    fastifyCloseGraceDelay: coerced.FASTIFY_CLOSE_GRACE_DELAY,
    logLevel: coerced.LOG_LEVEL,
    databaseUrl: coerced.DATABASE_URL,
    githubToken: coerced.GITHUB_TOKEN,
    aiApiKey: coerced.AI_API_KEY,
    aiModel: coerced.AI_MODEL,
    aiTemperature: coerced.AI_TEMPERATURE,
    aiSummaryConcurrency: coerced.AI_SUMMARY_CONCURRENCY,
    aiSummaryLimit: Math.max(1, Math.min(800, coerced.AI_SUMMARY_LIMIT ?? 100)),
    aiSummaryCron: coerced.AI_SUMMARY_CRON,
    aiSummaryStaleDays: coerced.AI_SUMMARY_STALE_DAYS,
    aiReadmeMaxChars: coerced.AI_README_MAX_CHARS,
    aiRpmLimit: coerced.AI_RPM_LIMIT,
    corsOrigin: coerced.CORS_ORIGIN,
    corsCredentials: coerced.CORS_CREDENTIALS,
    trustProxy: coerced.TRUST_PROXY,
    bodyLimit: coerced.BODY_LIMIT,
    helmetCsp: coerced.HELMET_CSP,
    jwtAccessSecret: coerced.JWT_ACCESS_SECRET,
    jwtRefreshSecret: coerced.JWT_REFRESH_SECRET,
    jwtAccessExpires: coerced.JWT_ACCESS_EXPIRES,
    jwtRefreshExpires: coerced.JWT_REFRESH_EXPIRES,
    authCookieName: coerced.AUTH_COOKIE_NAME,
    authCookieDomain: coerced.AUTH_COOKIE_DOMAIN,
    authCookieSecure: coerced.AUTH_COOKIE_SECURE,
    authCookieSameSite: coerced.AUTH_COOKIE_SAME_SITE,
    authAllowRegistration: coerced.AUTH_ALLOW_REGISTRATION,
    rateLimitWindow: coerced.RATE_LIMIT_WINDOW,
    rateLimitMax: coerced.RATE_LIMIT_MAX,
    redisHost: coerced.REDIS_HOST,
    redisPort: coerced.REDIS_PORT,
    redisPassword: coerced.REDIS_PASSWORD,
    bullPrefix: coerced.BULL_PREFIX,
    bullRole: coerced.BULL_ROLE,

    githubUsername: coerced.GITHUB_USERNAME,
    syncStarsCron: coerced.SYNC_STARS_CRON,
    syncConcurrency: coerced.SYNC_CONCURRENCY,
    syncJobAttempts: coerced.SYNC_JOB_ATTEMPTS,
    syncJobBackoffMs: coerced.SYNC_JOB_BACKOFF_MS,
    syncPerPage: coerced.SYNC_PER_PAGE,
    syncMaxPages: coerced.SYNC_MAX_PAGES,
    syncSoftDeleteUnstarred: coerced.SYNC_SOFT_DELETE_UNSTARRED,
    syncRequestTimeout: coerced.SYNC_REQUEST_TIMEOUT,
    notifyEmailEnabled: coerced.NOTIFY_EMAIL_ENABLED,
    smtpHost: coerced.SMTP_HOST,
    smtpPort: coerced.SMTP_PORT,
    smtpSecure: coerced.SMTP_SECURE,
    smtpUser: coerced.SMTP_USER,
    smtpPass: coerced.SMTP_PASS,
    mailFrom: coerced.MAIL_FROM,
    mailTo: coerced.MAIL_TO,
    // Provide hard defaults here to satisfy AppConfigSchema required fields
    rtExpiredCleanAfterDays: coerced.RT_EXPIRED_CLEAN_AFTER_DAYS ?? 0,
    rtRevokedRetentionDays: coerced.RT_REVOKED_RETENTION_DAYS ?? 7,
    rtCleanBatch: coerced.RT_CLEAN_BATCH ?? 1000,
    rtCleanDryRun: coerced.RT_CLEAN_DRY_RUN ?? true,

    bullCleanDryRun: coerced.BULL_DRY_RUN ?? true,
    bullCleanCompletedAfterDays: coerced.BULL_CLEAN_COMPLETED_AFTER_DAYS ?? 3,
    bullCleanFailedAfterDays: coerced.BULL_CLEAN_FAILED_AFTER_DAYS ?? 30,
    bullTrimEvents: coerced.BULL_TRIM_EVENTS ?? 1000,

    bullUiEnabled: coerced.BULL_UI_ENABLED ?? false,
    bullUiPath: coerced.BULL_UI_PATH ?? '/admin/queues/ui',
    bullUiReadOnly: coerced.BULL_UI_READONLY ?? true,
    bullUiPublic: coerced.BULL_UI_PUBLIC ?? false,

    maintEnabled: coerced.MAINT_ENABLED ?? true,
    maintCron: coerced.MAINT_CRON ?? '0 3 * * *',
  }

  // Final assert (defensive) and freeze for immutability
  Value.Assert(AppConfigSchema, cfg)
  return Object.freeze(cfg)
}
