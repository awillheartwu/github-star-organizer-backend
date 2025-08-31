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
    GITHUB_TOKEN: Type.Optional(Type.String()),
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
  },
  { additionalProperties: false }
)

type Env = Static<typeof EnvSchema>

// 3) 应用配置的形状暴露给代码库的其余部分
const AppConfigSchema = Type.Object(
  {
    env: Type.Union([Type.Literal('development'), Type.Literal('production')]),
    port: Type.Number(),
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
  }

  // Coerce and validate using TypeBox Value tools
  const coerced: Env = Value.Decode(EnvSchema, Value.Convert(EnvSchema, raw))

  const cfg: AppConfig = {
    env: coerced.NODE_ENV,
    port: coerced.PORT,
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
  }

  // Final assert (defensive) and freeze for immutability
  Value.Assert(AppConfigSchema, cfg)
  return Object.freeze(cfg)
}
