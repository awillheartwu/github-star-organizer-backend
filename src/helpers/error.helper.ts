import { FastifyReply } from 'fastify'
import { HTTP_STATUS, ERROR_TYPES, PRISMA_ERROR_CODES } from '../constants/errorCodes'

// 轻量判断 Octokit RequestError（避免直接硬依赖）
type OctokitLikeError = {
  name?: string
  status?: number
  response?: { headers?: Record<string, string | number | undefined> }
}
function isOctokitRequestError(err: unknown): err is OctokitLikeError {
  if (!err || typeof err !== 'object') return false
  const e = err as { name?: unknown; status?: unknown }
  const name = typeof e.name === 'string' ? e.name : ''
  const hasStatus = typeof e.status === 'number'
  return hasStatus || name.includes('RequestError')
}

function isTimeoutLike(err: unknown): boolean {
  const code = (err as { code?: unknown } | undefined)?.code
  return code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT' || code === 'ECONNABORTED'
}

function isRedisUnavailable(err: unknown): boolean {
  const code = (err as { code?: unknown } | undefined)?.code
  return code === 'ECONNREFUSED' || code === 'NR_CLOSED'
}

/**
 * 应用业务错误类型：携带 HTTP 状态码、错误类型标识与可选扩展信息。
 * 统一在控制层捕获并序列化，避免直接抛出裸 Error。
 * @category Helper
 */
export class AppError extends Error {
  statusCode: number
  errorType?: string
  extra?: Record<string, unknown>

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL.statusCode,
    errorType?: string,
    extra?: Record<string, unknown>
  ) {
    super(message)
    this.statusCode = statusCode
    this.errorType = errorType
    this.extra = extra
    Object.setPrototypeOf(this, AppError.prototype)
  }
}

// 用 unknown，类型守卫
/**
 * 统一错误响应处理：
 * - 自动识别 Prisma 错误码映射业务语义
 * - 处理自定义 `AppError`
 * - 处理 schema 校验失败（fastify-sensible 格式）
 * - 其他归类为 INTERNAL
 * @category Helper
 */
export function handleServerError(reply: FastifyReply, error: unknown) {
  reply.request.log.error(error)
  const headerString = ` ${reply.request.url}-${reply.request.method}`
  // 自动识别 Prisma 错误
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const prismaErr = error as { code: string; meta?: unknown }
    if (prismaErr.code in PRISMA_ERROR_CODES) {
      // 获取调用的 controller 路径（url）
      return reply.status(PRISMA_ERROR_CODES[prismaErr.code].statusCode).send({
        message: `[${headerString}] ${PRISMA_ERROR_CODES[prismaErr.code].message}`,
        code: PRISMA_ERROR_CODES[prismaErr.code].statusCode,
        errorType: PRISMA_ERROR_CODES[prismaErr.code].errorType,
        meta: prismaErr.meta,
      })
    }
  }

  // Octokit（GitHub API）错误归类
  if (isOctokitRequestError(error)) {
    const status = error.status ?? HTTP_STATUS.INTERNAL.statusCode
    const headers = error.response?.headers || {}
    // 二级限流（或 429/403 带 retry-after）
    const retryAfter = Number(headers['retry-after'] || '0')
    const remaining = Number(headers['x-ratelimit-remaining'] || '0')
    if (status === 429 || (status === 403 && Number.isFinite(retryAfter))) {
      return reply.status(HTTP_STATUS.RATE_LIMIT.statusCode).send({
        message: `[${headerString}] GitHub API rate limited`,
        code: HTTP_STATUS.RATE_LIMIT.statusCode,
        errorType: ERROR_TYPES.RATE_LIMIT,
        meta: { retryAfter, remaining },
      })
    }
    // 超时优先于上游 5xx 归类
    if (isTimeoutLike(error)) {
      return reply.status(HTTP_STATUS.GATEWAY_TIMEOUT.statusCode).send({
        message: `[${headerString}] GitHub request timeout`,
        code: HTTP_STATUS.GATEWAY_TIMEOUT.statusCode,
        errorType: ERROR_TYPES.TIMEOUT,
      })
    }
    if (status >= 500) {
      return reply.status(HTTP_STATUS.BAD_GATEWAY.statusCode).send({
        message: `[${headerString}] Upstream GitHub error (${status})`,
        code: HTTP_STATUS.BAD_GATEWAY.statusCode,
        errorType: ERROR_TYPES.EXTERNAL_SERVICE,
      })
    }
  }

  // Redis 不可用（常见 IORedis 错误码）
  if (isRedisUnavailable(error)) {
    return reply.status(HTTP_STATUS.SERVICE_UNAVAILABLE.statusCode).send({
      message: `[${headerString}] Redis unavailable`,
      code: HTTP_STATUS.SERVICE_UNAVAILABLE.statusCode,
      errorType: ERROR_TYPES.DEPENDENCY_UNAVAILABLE,
    })
  }

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.statusCode,
      errorType: error.errorType || ERROR_TYPES.APP,
      ...error.extra,
    })
  }

  if (typeof error === 'object' && error !== null && 'validation' in error) {
    const err = error as { message?: string; validation: unknown }
    return reply.status(HTTP_STATUS.BAD_REQUEST.statusCode).send({
      message: `[${headerString}] ${err.message || '参数校验失败'}`,
      code: HTTP_STATUS.BAD_REQUEST.statusCode,
      errorType: ERROR_TYPES.VALIDATION,
      errors: err.validation,
    })
  }

  return reply.status(HTTP_STATUS.INTERNAL.statusCode).send({
    message:
      process.env.NODE_ENV === 'development'
        ? ` [${headerString}] ${(error as Error)?.message || HTTP_STATUS.INTERNAL.message}`
        : ` [${headerString}] ${HTTP_STATUS.INTERNAL.message}`,
    code: HTTP_STATUS.INTERNAL.statusCode,
    errorType: (error as Error)?.name || ERROR_TYPES.INTERNAL,
  })
}
