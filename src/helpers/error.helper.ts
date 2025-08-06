import { FastifyReply } from 'fastify'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'

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
export function handleServerError(reply: FastifyReply, error: unknown) {
  // 日志
  reply.request.log.error(error)

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      message: error.message,
      code: error.statusCode,
      errorType: error.errorType || ERROR_TYPES.APP,
      ...error.extra,
    })
  }

  // Fastify校验错误（zod/ajv等会附加 error.validation）
  if (typeof error === 'object' && error !== null && 'validation' in error) {
    const err = error as { message?: string; validation: unknown }
    return reply.status(HTTP_STATUS.BAD_REQUEST.statusCode).send({
      message: err.message || '参数校验失败',
      code: HTTP_STATUS.BAD_REQUEST.statusCode,
      errorType: ERROR_TYPES.VALIDATION,
      errors: err.validation,
    })
  }

  // 其他情况（可根据环境区分是否显示 message）
  return reply.status(HTTP_STATUS.INTERNAL.statusCode).send({
    message:
      process.env.NODE_ENV === 'development'
        ? (error as Error)?.message || HTTP_STATUS.INTERNAL.message
        : HTTP_STATUS.INTERNAL.message,
    code: HTTP_STATUS.INTERNAL.statusCode,
    errorType: (error as Error)?.name || ERROR_TYPES.INTERNAL, // 这行
  })
}
