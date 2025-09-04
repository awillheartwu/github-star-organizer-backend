// src/plugins/auth.plugin.ts
import fp from 'fastify-plugin'
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import { AppError } from '../helpers/error.helper'

/**
 * 将 "30d" / "15m" / "1h" / "45s" / "3600"（秒）解析为 cookie 的 maxAge（单位：秒）
 * 仅做轻量解析，覆盖常见单位；不引入额外依赖。
 */
function parseDurationToSeconds(input: string): number {
  if (!input) return 0
  const m = String(input)
    .trim()
    .match(/^(\d+)\s*(ms|s|m|h|d)?$/i)
  if (!m) return 0
  const n = Number(m[1])
  const unit = (m[2] || 's').toLowerCase()
  switch (unit) {
    case 'ms':
      return Math.floor(n / 1000)
    case 's':
      return n
    case 'm':
      return n * 60
    case 'h':
      return n * 3600
    case 'd':
      return n * 86400
    default:
      return n // 兜底按秒
  }
}

/**
 * 鉴权插件：
 * - 注册 cookie（以便从 Cookie 读取/写入 Refresh Token）
 * - 注册两套 fastify-jwt（access / refresh），使用 namespace 隔离
 * - 暴露 verifyAccess、roleGuard、setRefreshCookie、clearRefreshCookie
 */
const authPlugin: FastifyPluginAsync = async (app) => {
  /**
   * 1) 注册 Cookie
   *
   * parseOptions 影响 cookie 的解析/序列化默认值（如 sameSite/secure）。
   * 注意：实际写入 Cookie 时我们会在 setRefreshCookie 里显式传 Options，
   * 以确保与 env 完全一致。
   */
  await app.register(cookie, {
    // 这里不必指定 secret（我们不做签名 Cookie）
    parseOptions: {
      // 这些默认值只是兜底；真正下发时仍以 setRefreshCookie 的参数为准
      httpOnly: true,
      sameSite: app.config.authCookieSameSite as 'lax' | 'strict' | 'none',
      secure: app.config.authCookieSecure,
      domain: app.config.authCookieDomain,
      path: '/', // 默认路径
    },
  })

  /**
   * 2) 注册 JWT（Access）
   *
   * 使用 namespace + 自定义别名：
   * - request.accessVerify() 等价于原生的 request.<ns>JwtVerify()
   * - reply.accessSign()     等价于原生的 reply.<ns>JwtSign()
   */
  await app.register(jwt, {
    secret: app.config.jwtAccessSecret,
    namespace: 'access',
    jwtVerify: 'accessVerify',
    jwtSign: 'accessSign',
    sign: {
      // Access 的签发默认过期时间（也可在具体 sign 时覆盖）
      expiresIn: app.config.jwtAccessExpires,
    },
  })

  /**
   * 3) 注册 JWT（Refresh）
   *
   * 单独的密钥与过期时间，原则上长期有效，仅用于 refresh。
   */
  await app.register(jwt, {
    secret: app.config.jwtRefreshSecret,
    namespace: 'refresh',
    jwtVerify: 'refreshVerify',
    jwtSign: 'refreshSign',
    cookie: { cookieName: app.config.authCookieName, signed: false }, // 允许从指定 Cookie 读取
    sign: {
      expiresIn: app.config.jwtRefreshExpires,
    },
  })

  /**
   * 4) 工具：设置/清除 Refresh Token Cookie
   *
   * - 只在 https 下发送（生产必须 secure=true）
   * - httpOnly 阻止 JS 读取（降低 XSS 风险）
   * - sameSite 对跨站行为的限制
   * - domain 控制子域共享（例如 .yourdomain.com）
   */
  app.decorate('setRefreshCookie', (reply: FastifyReply, token: string) => {
    const maxAge = parseDurationToSeconds(app.config.jwtRefreshExpires || '0')
    reply.setCookie(app.config.authCookieName, token, {
      httpOnly: true,
      secure: app.config.authCookieSecure,
      sameSite: app.config.authCookieSameSite as 'lax' | 'strict' | 'none',
      domain: app.config.authCookieDomain, // 例如 .yourdomain.com；本地可不设
      path: '/', // 也可限制到 '/auth' 路径
      maxAge: maxAge > 0 ? maxAge : undefined, // 秒；可不设 → 会话期 Cookie
    })
  })

  app.decorate('clearRefreshCookie', (reply: FastifyReply) => {
    reply.clearCookie(app.config.authCookieName, {
      path: '/',
      domain: app.config.authCookieDomain,
    })
  })

  /**
   * 5) 路由守卫：校验 Access Token
   *
   * 使用方式：
   *   fastify.get('/secure', { onRequest: [app.verifyAccess] }, handler)
   * 验证通过后，可从 request.user 拿到解码后的载荷（如 sub/role 等）。
   */
  app.decorate('verifyAccess', async (request: FastifyRequest /* , reply: FastifyReply */) => {
    try {
      // 使用我们上面注册的命名空间别名方法
      await request.accessVerify()
      // 验证通过后，fastify-jwt 会把 payload 放到 request.user
      // 这里可按需做额外检查（例如 token.type === 'access'）
      // if ((request.user as any)?.type !== 'access') throw app.httpErrors.unauthorized()

      // 即时失效：校验 tokenVersion（ver）
      const userId = request.user?.sub
      const tokenVer = request.user?.ver ?? 0
      if (userId) {
        const key = `tv:${userId}`
        let currentVer: number | undefined
        const cached = await app.redis.get(key).catch(() => null)
        if (cached != null) {
          const n = Number(cached)
          if (Number.isFinite(n)) currentVer = n
        }
        if (currentVer === undefined) {
          const row = await app.prisma.user.findUnique({
            where: { id: userId },
            select: { tokenVersion: true },
          })
          currentVer = row?.tokenVersion ?? 0
          void app.redis.set(key, String(currentVer), 'EX', 1800).catch(() => void 0)
        }
        if (currentVer !== tokenVer) {
          throw new AppError(
            'Access token invalidated',
            HTTP_STATUS.UNAUTHORIZED.statusCode,
            ERROR_TYPES.UNAUTHORIZED,
            { reason: 'tokenVersion_mismatch' }
          )
        }
      }
    } catch (err) {
      // 统一交给错误处理器/或直接返回 401
      throw new AppError(
        `Unauthorized: ${(err as Error).message}`,
        HTTP_STATUS.UNAUTHORIZED.statusCode,
        ERROR_TYPES.UNAUTHORIZED,
        { cause: err }
      )
    }
  })

  /**
   * 6) RBAC：基于角色的访问控制
   *
   * 使用方式：
   *   fastify.get('/admin', {
   *     onRequest: [app.verifyAccess, app.roleGuard('ADMIN')]
   *   }, handler)
   */
  app.decorate('roleGuard', (...roles: string[]) => {
    return async (request: FastifyRequest /* , reply: FastifyReply */) => {
      // 假设 access 的 payload 中包含 role（如 'USER' / 'ADMIN'）
      const role = request.user?.role
      if (!role || !roles.includes(role)) {
        throw new AppError(
          `Forbidden: role ${role} cannot access this resource`,
          HTTP_STATUS.FORBIDDEN.statusCode,
          ERROR_TYPES.FORBIDDEN,
          { requiredRoles: roles, actualRole: role }
        )
      }
    }
  })
}

export default fp(authPlugin, {
  name: 'auth-plugin',
  dependencies: ['config'],
})
