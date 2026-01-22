import { Value } from '@sinclair/typebox/value'
import { EnvSchema, loadConfig } from '../config/loadConfig.config'

// Validate production env in CI before deploy.
process.env.NODE_ENV = 'production'

try {
  loadConfig()
  // eslint-disable-next-line no-console
  console.log('env validation: ok')
} catch (error) {
  // Rebuild raw env map to get detailed schema errors.
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

  const converted = Value.Convert(EnvSchema, raw)
  const errors = [...Value.Errors(EnvSchema, converted)]
  const message = error instanceof Error ? error.message : String(error)
  // eslint-disable-next-line no-console
  console.error(`env validation: failed - ${message}`)
  if (errors.length) {
    // eslint-disable-next-line no-console
    const details = errors.map((e) => `${e.path} ${e.message}`).join('; ')
    // eslint-disable-next-line no-console
    console.error('env validation details:', details)
  }
  process.exit(1)
}
