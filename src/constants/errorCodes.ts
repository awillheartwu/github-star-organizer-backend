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
  INTERNAL: { message: 'Internal Server Error', statusCode: 500 },
} as const

// 错误类型
export const ERROR_TYPES = {
  VALIDATION: 'ValidationError',
  AUTH: 'AuthError',
  APP: 'AppError',
  INTERNAL: 'Internal',
  NOT_FOUND: 'NotFound',
} as const
