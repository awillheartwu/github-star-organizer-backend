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
  }

  // Final assert (defensive) and freeze for immutability
  Value.Assert(AppConfigSchema, cfg)
  return Object.freeze(cfg)
}
