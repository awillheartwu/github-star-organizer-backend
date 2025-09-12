// HTTP状态码标准
export const HTTP_STATUS = {
  OK: { message: 'OK', statusCode: 200 },
  CREATED: { message: 'Created', statusCode: 201 },
  ACCEPTED: { message: 'Accepted', statusCode: 202 },
  NO_CONTENT: { message: 'No Content', statusCode: 204 },
  RESET_CONTENT: { message: 'Reset Content', statusCode: 205 },
  PARTIAL_CONTENT: { message: 'Partial Content', statusCode: 206 },
  BAD_REQUEST: { message: 'Bad Request', statusCode: 400 },
  UNAUTHORIZED: { message: 'Unauthorized', statusCode: 401 },
  FORBIDDEN: { message: 'Forbidden', statusCode: 403 },
  NOT_FOUND: { message: 'Not Found', statusCode: 404 },
  PRECONDITION_FAILED: { message: 'Precondition Failed', statusCode: 412 },
  INTERNAL: { message: 'Internal Server Error', statusCode: 500 },
  CONFLICT: { message: 'Conflict', statusCode: 409 },
  RATE_LIMIT: { message: 'Too Many Requests', statusCode: 429 },
  BAD_GATEWAY: { message: 'Bad Gateway', statusCode: 502 },
  SERVICE_UNAVAILABLE: { message: 'Service Unavailable', statusCode: 503 },
  GATEWAY_TIMEOUT: { message: 'Gateway Timeout', statusCode: 504 },
} as const

// 错误类型
export const ERROR_TYPES = {
  VALIDATION: 'ValidationError',
  AUTH: 'AuthError',
  APP: 'AppError',
  INTERNAL: 'Internal',
  NOT_FOUND: 'NotFound',
  PRISMA_UNIQUE: 'PrismaUniqueError',
  CONFLICT: 'ConflictError',
  UNAUTHORIZED: 'UnauthorizedError',
  FORBIDDEN: 'ForbiddenError',
  RATE_LIMIT: 'RateLimitError',
  EXTERNAL_SERVICE: 'ExternalServiceError',
  DEPENDENCY_UNAVAILABLE: 'DependencyUnavailable',
  TIMEOUT: 'TimeoutError',
  PRECONDITION_FAILED: 'PreconditionFailed',
} as const

// Prisma 错误码映射
export const PRISMA_ERROR_CODES: Record<
  string,
  { message: string; statusCode: number; errorType: string }
> = {
  P2002: {
    message: '唯一约束冲突，相关字段已存在',
    statusCode: 409,
    errorType: ERROR_TYPES.PRISMA_UNIQUE,
  },
  P2025: {
    message: '目标记录不存在',
    statusCode: 404,
    errorType: ERROR_TYPES.NOT_FOUND,
  },
  P2003: {
    message: '外键约束失败',
    statusCode: 409,
    errorType: ERROR_TYPES.CONFLICT,
  },
  // 连接不可用（常见在 dev 容器未准备好时）
  P1001: {
    message: '数据库连接失败',
    statusCode: 503,
    errorType: ERROR_TYPES.DEPENDENCY_UNAVAILABLE,
  },
  // 可继续扩展其他 Prisma 错误码
}
