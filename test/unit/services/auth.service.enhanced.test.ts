// test/unit/services/auth.service.test.ts
import * as authService from '../../../src/services/auth.service'
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'
import { PrismaClient } from '@prisma/client'

describe('AuthService Extended Tests', () => {
  let prisma: PrismaClient
  let ctx: Ctx

  beforeAll(async () => {
    prisma = await TestDatabase.setup()
    ctx = createMockContext(prisma)
  })

  afterAll(async () => {
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()
  })

  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      const email = 'test@example.com'
      const password = 'password123'
      const displayName = 'Test User'

      const user = await authService.createUser(ctx, email, password, displayName)

      expect(user.email).toBe(email)
      expect(user.displayName).toBe(displayName)
      expect(user.role).toBe('USER')
      expect(user.passwordHash).toBeDefined()
      expect(user.passwordHash).not.toBe(password) // 确保密码被哈希
    })

    it('should throw error for duplicate email', async () => {
      const email = 'duplicate@example.com'
      const password = 'password123'

      await authService.createUser(ctx, email, password)

      await expect(authService.createUser(ctx, email, password)).rejects.toThrow(
        'Email already registered'
      )
    })

    it('should create user without display name', async () => {
      const email = 'nodisplay@example.com'
      const password = 'password123'

      const user = await authService.createUser(ctx, email, password)

      expect(user.email).toBe(email)
      expect(user.displayName).toBeNull()
    })
  })

  describe('findUserByEmail', () => {
    beforeEach(async () => {
      await authService.createUser(ctx, 'existing@example.com', 'password123', 'Existing User')
    })

    it('should find existing user', async () => {
      const user = await authService.findUserByEmail(ctx, 'existing@example.com')

      expect(user).toBeDefined()
      expect(user?.email).toBe('existing@example.com')
      expect(user?.passwordHash).toBeDefined()
    })

    it('should return null for non-existent user', async () => {
      const user = await authService.findUserByEmail(ctx, 'nonexistent@example.com')
      expect(user).toBeNull()
    })
  })

  describe('password verification', () => {
    it('should verify correct password', async () => {
      const password = 'mySecretPassword'
      const hash = await authService.hashPassword(password)

      const isValid = await authService.verifyPassword(hash, password)
      expect(isValid).toBe(true)
    })

    it('should reject incorrect password', async () => {
      const password = 'mySecretPassword'
      const wrongPassword = 'wrongPassword'
      const hash = await authService.hashPassword(password)

      const isValid = await authService.verifyPassword(hash, wrongPassword)
      expect(isValid).toBe(false)
    })
  })

  describe('refresh token management', () => {
    let testUser: { id: string; email: string; passwordHash: string }

    beforeEach(async () => {
      testUser = await authService.createUser(ctx, 'refresh@example.com', 'password123')
    })

    it('should persist refresh token', async () => {
      const refreshToken = 'test-refresh-token'
      const jti = authService.genJti()
      const ip = '127.0.0.1'
      const userAgent = 'test-browser'

      await authService.persistRefreshToken(ctx, testUser.id, refreshToken, jti, ip, userAgent)

      const storedToken = await prisma.refreshToken.findFirst({
        where: { userId: testUser.id },
      })

      expect(storedToken).toBeDefined()
      expect(storedToken?.userId).toBe(testUser.id)
      expect(storedToken?.jti).toBe(jti)
      expect(storedToken?.ip).toBe(ip)
      expect(storedToken?.userAgent).toBe(userAgent)
      expect(storedToken?.revoked).toBe(false)
    })

    it('should validate refresh token', async () => {
      const refreshToken = 'valid-refresh-token'
      const jti = authService.genJti()

      await authService.persistRefreshToken(ctx, testUser.id, refreshToken, jti)

      const result = await authService.assertRefreshValid(ctx, refreshToken)

      expect(result.userId).toBe(testUser.id)
      expect(result.jti).toBe(jti)
      expect(result.revoked).toBe(false)
    })

    it('should throw error for invalid refresh token', async () => {
      await expect(authService.assertRefreshValid(ctx, 'invalid-token')).rejects.toThrow(
        'Refresh token not found'
      )
    })

    it('should throw error for revoked refresh token', async () => {
      const refreshToken = 'revoked-refresh-token'
      const jti = authService.genJti()

      await authService.persistRefreshToken(ctx, testUser.id, refreshToken, jti)

      // 撤销令牌
      await authService.revokeRefreshByToken(ctx, refreshToken)

      await expect(authService.assertRefreshValid(ctx, refreshToken)).rejects.toThrow(
        'Refresh token revoked'
      )
    })

    it('should throw error for expired refresh token', async () => {
      const token = 'expired-token'
      const hash = authService.sha256(token)
      const past = new Date(Date.now() - 1000)
      await prisma.refreshToken.create({
        data: {
          userId: testUser.id,
          tokenHash: hash,
          jti: 'expired-jti',
          expiresAt: past,
          revoked: false,
        },
      })

      await expect(authService.assertRefreshValid(ctx, token)).rejects.toThrow(
        'Refresh token expired'
      )
    })

    it('revokeRefreshByToken should not throw on missing token', async () => {
      await expect(authService.revokeRefreshByToken(ctx, 'not-exist')).resolves.toBeUndefined()
    })

    it('should rotate refresh token', async () => {
      const oldToken = 'old-refresh-token'
      const newToken = 'new-refresh-token'
      const oldJti = authService.genJti()
      const newJti = authService.genJti()

      await authService.persistRefreshToken(ctx, testUser.id, oldToken, oldJti)

      await authService.rotateRefreshToken(
        ctx,
        oldToken,
        testUser.id,
        newToken,
        newJti,
        '127.0.0.1',
        'test-browser'
      )

      // 检查旧令牌被撤销
      const oldTokenRecord = await prisma.refreshToken.findFirst({
        where: { jti: oldJti },
      })
      expect(oldTokenRecord?.revoked).toBe(true)

      // 检查新令牌被创建
      const newTokenRecord = await prisma.refreshToken.findFirst({
        where: { jti: newJti },
      })
      expect(newTokenRecord).toBeDefined()
      expect(newTokenRecord?.revoked).toBe(false)
    })

    it('should revoke all refresh tokens for user', async () => {
      // 创建多个 refresh token
      for (let i = 0; i < 3; i++) {
        await authService.persistRefreshToken(ctx, testUser.id, `token-${i}`, `jti-${i}`)
      }

      await authService.revokeAllRefreshOfUser(ctx, testUser.id)

      const tokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      })

      expect(tokens.every((t) => t.revoked)).toBe(true)
    })
  })

  describe('token version management', () => {
    let testUser: { id: string; email: string; passwordHash: string }

    beforeEach(async () => {
      testUser = await authService.createUser(ctx, 'version@example.com', 'password123')
    })

    it('should bump token version', async () => {
      const originalVersion = 0 // 新用户的初始版本

      const newTokenVersion = await authService.bumpTokenVersion(ctx, testUser.id)

      expect(newTokenVersion).toBe(originalVersion + 1)
    })

    it('should cache token version', async () => {
      const version = 5
      const mockRedisSet = jest.fn().mockResolvedValue('OK')

      // 直接替换 Redis set 方法
      const originalSet = ctx.redis.set
      ctx.redis.set = mockRedisSet

      try {
        await authService.cacheTokenVersion(ctx, testUser.id, version)

        // 验证缓存（这里使用 mock redis，所以检查调用）
        expect(mockRedisSet).toHaveBeenCalledWith(`tv:${testUser.id}`, String(version), 'EX', 1800)
      } finally {
        // 恢复原始方法
        ctx.redis.set = originalSet
      }
    })
  })
})
