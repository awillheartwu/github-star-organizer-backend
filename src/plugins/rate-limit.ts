// src/plugins/rate-limit.plugin.ts
import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import { AppError } from '../helpers/error.helper'
import { ERROR_TYPES, HTTP_STATUS } from '../constants/errorCodes'

export default fp(
  async (app) => {
    // 建立 Redis 连接
    await app.register(rateLimit, {
      global: false,
      timeWindow: app.config.rateLimitWindow,
      max: app.config.rateLimitMax,
      keyGenerator: (req) => req.user?.sub ?? req.ip,
      redis: app.redis, // 复用在 redis 插件中注册的单例
      errorResponseBuilder: (req, ctx) => {
        throw new AppError(
          'Too many requests',
          HTTP_STATUS.RATE_LIMIT.statusCode,
          ERROR_TYPES.RATE_LIMIT,
          {
            ttl: ctx.ttl,
            max: ctx.max,
          }
        )
      },
    })
  },
  { name: 'rate-limit-plugin', dependencies: ['redis', 'config'] }
)
