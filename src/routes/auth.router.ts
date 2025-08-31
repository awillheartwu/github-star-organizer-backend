// src/routes/auth.router.ts
import { FastifyInstance } from 'fastify'
import {
  AuthTag,
  RegisterBodySchema,
  LoginBodySchema,
  ChangePasswordBodySchema,
  AccessTokenResponseSchema,
  MeResponseSchema,
  BasicMessageSchema,
} from '../schemas/auth.schema'
import { authController } from '../controllers'

export default async function authRoutes(fastify: FastifyInstance) {
  // 注册（受开关控制，controller 内部判断 config.authAllowRegistration）
  fastify.post(
    '/auth/register',
    {
      schema: {
        tags: [AuthTag],
        summary: 'Register',
        description: '注册（如启用）',
        body: RegisterBodySchema,
        response: { 201: BasicMessageSchema },
      },
    },
    authController.register
  )

  // 登录：返回 accessToken；refresh 通过 httpOnly Cookie 下发
  fastify.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          timeWindow: fastify.config.rateLimitWindow, // 直接复用 env
          max: Math.min(fastify.config.rateLimitMax, 10),
          hook: 'onRequest', // 限流发生在最前面
        },
      },
      schema: {
        tags: [AuthTag],
        summary: 'Login',
        description: '登录，成功后返回 accessToken,并在 httpOnly Cookie 下发 refreshToken',
        body: LoginBodySchema,
        response: { 200: AccessTokenResponseSchema },
      },
    },
    authController.login
  )

  // 刷新：旋转 refresh，返回新的 accessToken
  fastify.post(
    '/auth/refresh',
    {
      config: {
        rateLimit: {
          timeWindow: fastify.config.rateLimitWindow,
          max: Math.min(fastify.config.rateLimitMax, 5),
          hook: 'onRequest',
        },
      },
      schema: {
        tags: [AuthTag],
        summary: 'Refresh access token',
        description: '使用 refresh token 换取新的 access token',
        response: { 200: AccessTokenResponseSchema },
      },
    },
    authController.refresh
  )

  // 登出：撤销当前 refresh + 清 cookie（需要已登录）
  fastify.post(
    '/auth/logout',
    {
      onRequest: [fastify.verifyAccess],
      schema: {
        tags: [AuthTag],
        summary: 'Logout',
        description: '登出，撤销当前 refresh token',
        response: { 204: { type: 'null' } },
        security: [{ bearerAuth: [] }],
      },
    },
    authController.logout
  )

  // 当前用户信息（从 access token 解出）
  fastify.get(
    '/auth/me',
    {
      onRequest: [fastify.verifyAccess],
      schema: {
        tags: [AuthTag],
        summary: 'Current user',
        description: '获取当前登录用户的信息',
        response: { 200: MeResponseSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    authController.me
  )

  // 修改密码（需要 access；成功后可选：强制下线所有 refresh）
  fastify.post(
    '/auth/change-password',
    {
      config: {
        rateLimit: {
          timeWindow: fastify.config.rateLimitWindow,
          max: Math.min(fastify.config.rateLimitMax, 5),
          hook: 'onRequest',
        },
      },
      onRequest: [fastify.verifyAccess],
      schema: {
        tags: [AuthTag],
        summary: 'Change password',
        description: '修改密码(需要 access token)',
        body: ChangePasswordBodySchema,
        response: { 200: BasicMessageSchema },
        security: [{ bearerAuth: [] }],
      },
    },
    authController.changePassword
  )
}
