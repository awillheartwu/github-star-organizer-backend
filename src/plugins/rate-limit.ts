// src/plugins/rate-limit.plugin.ts
import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import { config } from '../config'
// import IORedis from 'ioredis'
// const redis = new IORedis(process.env.REDIS_URL!)

export default fp(
  async (app) => {
    await app.register(rateLimit, {
      global: false, // 不全局生效，按路由单独开启
      nameSpace: 'auth', // 可选：区分不同功能的限流空间
      timeWindow: config.rateLimitWindow, // 例：60000（ms）
      max: config.rateLimitMax, // 例：20
      keyGenerator: (req) => req.ip, // 以 IP 维度限流（也可按用户ID等）
      // 如果你想统一返回格式，可以开启自定义响应（可选）：
      /* errorResponseBuilder: (req, ctx) => ({
      message: 'Too many requests',
      code: 'RATE_LIMIT',
      statusCode: 429,
      // 也可以把 ctx 增加进去查看剩余额度 ctx.max, ctx.ttl 等
    }), */
      // 生产建议接 Redis：redis: new IORedis(process.env.REDIS_URL!)
    })

    /* await app.register(rateLimit, {
      global: false,
      timeWindow: config.rateLimitWindow,
      max: config.rateLimitMax,
      keyGenerator: (req) => req.ip,
      redis,
    }) */
  },
  { name: 'rate-limit-plugin' }
)
