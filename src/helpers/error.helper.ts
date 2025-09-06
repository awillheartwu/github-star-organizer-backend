import { FastifyReply } from 'fastify'
import { HTTP_STATUS, ERROR_TYPES, PRISMA_ERROR_CODES } from '../constants/errorCodes'

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
