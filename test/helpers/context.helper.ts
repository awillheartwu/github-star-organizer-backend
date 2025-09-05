// test/helpers/context.helper.ts
import { PrismaClient } from '@prisma/client'
import type { Ctx } from '../../src/helpers/context.helper'
import type { AppConfig } from '../../src/config'

const mockConfig: AppConfig = {
  env: 'development', // 使用允许的值
  port: 3999,
  fastifyCloseGraceDelay: '200',
  logLevel: 'silent',
  databaseUrl: 'file:./test.db',
  githubToken: 'test-github-token',
  aiApiKey: 'test-ai-key',
  aiModel: 'deepseek-chat',
  aiTemperature: 0.3,
  corsOrigin: '*',
  corsCredentials: false,
  trustProxy: false,
  bodyLimit: 1048576,
  helmetCsp: false,
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
  jwtAccessExpires: '15m',
  jwtRefreshExpires: '7d',
  authCookieName: 'rt',
  authCookieDomain: undefined,
  authCookieSecure: false,
  authCookieSameSite: 'lax',
  authAllowRegistration: true,
  rateLimitWindow: 60000,
  rateLimitMax: 20,
  redisHost: '127.0.0.1',
  redisPort: 6379,
  redisPassword: 'pass',
  bullPrefix: 'gsor-test',
  bullRole: 'producer',
  githubUsername: 'testuser',
  syncStarsCron: '0 5 * * *',
  syncConcurrency: 1,
  syncJobAttempts: 1,
  syncJobBackoffMs: 1000,
  syncPerPage: 10,
  syncMaxPages: 0,
  syncSoftDeleteUnstarred: false,
  syncRequestTimeout: 1000,
  notifyEmailEnabled: false,
  smtpHost: undefined,
  smtpPort: 465,
  smtpSecure: true,
  smtpUser: undefined,
  smtpPass: undefined,
  mailFrom: undefined,
  mailTo: undefined,
  rtExpiredCleanAfterDays: 0,
  rtRevokedRetentionDays: 7,
  rtCleanBatch: 100,
  rtCleanDryRun: true,
  bullCleanDryRun: true,
  bullCleanCompletedAfterDays: 3,
  bullCleanFailedAfterDays: 30,
  bullTrimEvents: 500,
  maintEnabled: false,
  maintCron: '0 3 * * *',
}

const mockLogger = {
  info: () => {},
  error: () => {},
  warn: () => {},
  debug: () => {},
  trace: () => {},
  fatal: () => {},
  child: () => mockLogger,
  level: 'silent',
  silent: false,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

const mockRedis = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve('OK'),
  del: () => Promise.resolve(1),
  quit: () => Promise.resolve('OK'),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any

export function createMockContext(prisma: PrismaClient): Ctx {
  return {
    prisma,
    log: mockLogger,
    config: mockConfig,
    redis: mockRedis,
  }
}

export { mockConfig, mockLogger, mockRedis }
