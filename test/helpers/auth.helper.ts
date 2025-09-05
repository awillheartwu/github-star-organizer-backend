// test/helpers/auth.helper.ts
import { FastifyInstance } from 'fastify'
import { TestDatabase } from './database.helper'
import * as authService from '../../src/services/auth.service'
import { createMockContext } from './context.helper'

export interface TestUser {
  id: string
  email: string
  passwordHash: string
  role: 'USER' | 'ADMIN'
  password: string // 保存原始密码用于测试
}

export async function createTestUser(
  email = 'test@example.com',
  password = 'password123',
  role: 'USER' | 'ADMIN' = 'USER',
  app?: FastifyInstance
): Promise<TestUser> {
  if (app) {
    // 使用注册端点创建用户（更可靠）
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        email,
        password,
        displayName: 'Test User',
      },
    })

    if (registerResponse.statusCode !== 201) {
      throw new Error(`Registration failed: ${registerResponse.payload}`)
    }

    // 如果需要管理员权限，更新用户角色
    if (role === 'ADMIN') {
      const prisma = TestDatabase.getInstance()
      await prisma.user.update({
        where: { email },
        data: { role: 'ADMIN' },
      })
    }

    // 获取创建的用户信息
    const prisma = TestDatabase.getInstance()
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true },
    })

    if (!user) {
      throw new Error('User not found after registration')
    }

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role as 'USER' | 'ADMIN',
      password,
    }
  } else {
    // 备用方法：直接使用service（可能有问题）
    const prisma = TestDatabase.getInstance()
    const ctx = createMockContext(prisma)

    const user = await authService.createUser(ctx, email, password)

    if (role === 'ADMIN') {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      })
    }

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      role,
      password,
    }
  }
}

export async function getAuthToken(
  app: FastifyInstance,
  user: { email: string; password?: string },
  defaultPassword = 'password123'
): Promise<string> {
  const password = user.password || defaultPassword

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: user.email,
      password,
    },
  })

  if (loginResponse.statusCode !== 200) {
    throw new Error(`Login failed: ${loginResponse.payload}`)
  }

  const result = JSON.parse(loginResponse.payload)
  return result.data.accessToken
}

export async function getRefreshCookie(
  app: FastifyInstance,
  user: { email: string; password?: string },
  defaultPassword = 'password123'
): Promise<string> {
  const password = user.password || defaultPassword

  const loginResponse = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: {
      email: user.email,
      password,
    },
  })

  if (loginResponse.statusCode !== 200) {
    throw new Error(`Login failed: ${loginResponse.payload}`)
  }

  const refreshCookie = loginResponse.cookies.find((c) => c.name === 'rt')
  if (!refreshCookie) {
    throw new Error('Refresh cookie not found')
  }

  return refreshCookie.value
}
