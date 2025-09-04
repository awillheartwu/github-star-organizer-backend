import path from 'node:path'
import { config as dotenv } from 'dotenv'
import { Type, type Static } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'

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
const EnvSchema = Type.Object(
  {
    NODE_ENV: Type.Union([Type.Literal('development'), Type.Literal('production')], {
      default: 'development',
    }),
    PORT: Type.Number({ default: 3000 }),
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
    DATABASE_URL: Type.String({ default: 'file:./dev.db' }),
    DEEPSEEK_API_KEY: Type.Optional(Type.String()),
    // cors相关
    CORS_ORIGIN: Type.Optional(Type.String({ default: '*' })), // 允许的 origin，多个可用逗号分隔
    CORS_CREDENTIALS: Type.Optional(Type.Boolean({ default: false })),
    TRUST_PROXY: Type.Optional(Type.Boolean({ default: false })),
    BODY_LIMIT: Type.Optional(Type.Number({ default: 1048576 })), // 1MB
    HELMET_CSP: Type.Optional(Type.Boolean({ default: true })), // 是否启用 CSP
    // auth 相关
    JWT_ACCESS_SECRET: Type.String(),
    JWT_REFRESH_SECRET: Type.String(),
    JWT_ACCESS_EXPIRES: Type.String({ default: '15m' }),
    JWT_REFRESH_EXPIRES: Type.String({ default: '30d' }),

    AUTH_COOKIE_NAME: Type.String({ default: 'rt' }),
    AUTH_COOKIE_DOMAIN: Type.Optional(Type.String()), // 可为空
    AUTH_COOKIE_SECURE: Type.Boolean({ default: false }),
    AUTH_COOKIE_SAME_SITE: Type.Union(
      [Type.Literal('lax'), Type.Literal('strict'), Type.Literal('none')],
      { default: 'lax' }
    ),

    AUTH_ALLOW_REGISTRATION: Type.Boolean({ default: true }),

    // 可选：限流
    RATE_LIMIT_WINDOW: Type.Optional(Type.Number({ default: 60000 })), // ms
    RATE_LIMIT_MAX: Type.Optional(Type.Number({ default: 20 })),

    // 放在 EnvSchema 的对象里（保持风格一致）
    REDIS_HOST: Type.String({}),
    REDIS_PORT: Type.Number({ default: 6379 }),
    REDIS_PASSWORD: Type.String({}),
    BULL_PREFIX: Type.String({ default: 'gsor' }), // bullmq key 前缀
    BULL_ROLE: Type.Union(
      [Type.Literal('both'), Type.Literal('worker'), Type.Literal('producer')],
      { default: 'both' }
    ),

    // 同步任务参数
    GITHUB_TOKEN: Type.Optional(Type.String()),
    GITHUB_USERNAME: Type.String(), // 拉谁的 stars

    SYNC_STARS_CRON: Type.Optional(Type.String({ default: '0 5 * * *' })), // 每天 05:00
    SYNC_CONCURRENCY: Type.Optional(Type.Number({ default: 2 })), // worker 并发
    SYNC_JOB_ATTEMPTS: Type.Optional(Type.Number({ default: 3 })),
    SYNC_JOB_BACKOFF_MS: Type.Optional(Type.Number({ default: 30000 })),
    SYNC_PER_PAGE: Type.Optional(Type.Number({ default: 50 })),
    SYNC_MAX_PAGES: Type.Optional(Type.Number({ default: 0 })), // 0=不限
    SYNC_SOFT_DELETE_UNSTARRED: Type.Optional(Type.Boolean({ default: false })),
    SYNC_REQUEST_TIMEOUT: Type.Optional(Type.Number({ default: 15000 })),
    // 邮件通知（可选）
    NOTIFY_EMAIL_ENABLED: Type.Optional(Type.Boolean({ default: false })),
    SMTP_HOST: Type.Optional(Type.String()),
    SMTP_PORT: Type.Optional(Type.Number({ default: 465 })),
    SMTP_SECURE: Type.Optional(Type.Boolean({ default: true })),
    SMTP_USER: Type.Optional(Type.String()),
    SMTP_PASS: Type.Optional(Type.String()),
    MAIL_FROM: Type.Optional(Type.String()),
    MAIL_TO: Type.Optional(Type.String()),

    // 新版：更细粒度的 RT 清理参数
    RT_EXPIRED_CLEAN_AFTER_DAYS: Type.Optional(Type.Number({ default: 0 })),
    RT_REVOKED_RETENTION_DAYS: Type.Optional(Type.Number({ default: 7 })),
    RT_CLEAN_BATCH: Type.Optional(Type.Number({ default: 1000 })),
    RT_CLEAN_DRY_RUN: Type.Optional(Type.Boolean({ default: true })),

    // BullMQ 清理参数（可选）
    BULL_DRY_RUN: Type.Optional(Type.Boolean({ default: true })),
    BULL_CLEAN_COMPLETED_AFTER_DAYS: Type.Optional(Type.Number({ default: 3 })),
    BULL_CLEAN_FAILED_AFTER_DAYS: Type.Optional(Type.Number({ default: 30 })),
    BULL_TRIM_EVENTS: Type.Optional(Type.Number({ default: 1000 })),

    // 维护任务（repeatable job）
    MAINT_ENABLED: Type.Optional(Type.Boolean({ default: true })),
    MAINT_CRON: Type.Optional(Type.String({ default: '0 3 * * *' })),
  },

  { additionalProperties: false }
)

type Env = Static<typeof EnvSchema>

// 3) 应用配置的形状暴露给代码库的其余部分
const AppConfigSchema = Type.Object(
  {
    env: Type.Union([Type.Literal('development'), Type.Literal('production')]),
    port: Type.Number(),
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
    deepseekApiKey: Type.Optional(Type.String()),
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

    // 维护任务开关/时间
    maintEnabled: Type.Boolean(),
    maintCron: Type.String(),
  },
  { additionalProperties: false }
)
export type AppConfig = Static<typeof AppConfigSchema>

export function loadConfig(): AppConfig {
  // Load .env files
  loadDotenvFiles()

  // Collect raw values (all strings from process.env)
  const raw = {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    FASTIFY_CLOSE_GRACE_DELAY: process.env.FASTIFY_CLOSE_GRACE_DELAY,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DATABASE_URL: process.env.DATABASE_URL,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
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

    MAINT_ENABLED: process.env.MAINT_ENABLED,
    MAINT_CRON: process.env.MAINT_CRON,
  }

  // Coerce and validate using TypeBox Value tools
  const coerced: Env = Value.Decode(EnvSchema, Value.Convert(EnvSchema, raw))

  const cfg: AppConfig = {
    env: coerced.NODE_ENV,
    port: coerced.PORT,
    fastifyCloseGraceDelay: coerced.FASTIFY_CLOSE_GRACE_DELAY,
    logLevel: coerced.LOG_LEVEL,
    databaseUrl: coerced.DATABASE_URL,
    githubToken: coerced.GITHUB_TOKEN,
    deepseekApiKey: coerced.DEEPSEEK_API_KEY,
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

    maintEnabled: coerced.MAINT_ENABLED ?? true,
    maintCron: coerced.MAINT_CRON ?? '0 3 * * *',
  }

  // Final assert (defensive) and freeze for immutability
  Value.Assert(AppConfigSchema, cfg)
  return Object.freeze(cfg)
}
