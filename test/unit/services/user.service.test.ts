// test/unit/services/user.service.test.ts
import * as userService from '../../../src/services/user.service'
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'
import { PrismaClient } from '@prisma/client'
import * as authService from '../../../src/services/auth.service'

describe('UserService', () => {
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

  describe('setUserRole', () => {
    let testUser: { id: string; email: string; role: string }

    beforeEach(async () => {
      testUser = await authService.createUser(
        ctx,
        'testuser@example.com',
        'password123',
        'Test User'
      )
    })

    it('should change user role from USER to ADMIN', async () => {
      expect(testUser.role).toBe('USER')

      const result = await userService.setUserRole(ctx, testUser.id, 'ADMIN')

      expect(result.ok).toBe(true)

      // Verify role was changed in database
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { role: true, tokenVersion: true },
      })
      expect(updatedUser?.role).toBe('ADMIN')
      expect(updatedUser?.tokenVersion).toBe(1) // Should be incremented
    })

    it('should change user role from ADMIN to USER', async () => {
      // First make user an admin
      await prisma.user.update({
        where: { id: testUser.id },
        data: { role: 'ADMIN' },
      })

      const result = await userService.setUserRole(ctx, testUser.id, 'USER')

      expect(result.ok).toBe(true)

      // Verify role was changed back to USER
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { role: true },
      })
      expect(updatedUser?.role).toBe('USER')
    })

    it('should increment token version when changing role', async () => {
      const originalUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { tokenVersion: true },
      })
      const originalVersion = originalUser?.tokenVersion ?? 0

      await userService.setUserRole(ctx, testUser.id, 'ADMIN')

      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { tokenVersion: true },
      })
      expect(updatedUser?.tokenVersion).toBe(originalVersion + 1)
    })

    it('should revoke all refresh tokens when changing role', async () => {
      // Create some refresh tokens for the user
      const refreshToken1 = 'refresh-token-1'
      const refreshToken2 = 'refresh-token-2'
      const jti1 = authService.genJti()
      const jti2 = authService.genJti()

      await authService.persistRefreshToken(ctx, testUser.id, refreshToken1, jti1)
      await authService.persistRefreshToken(ctx, testUser.id, refreshToken2, jti2)

      // Verify tokens are active
      const activeBefore = await prisma.refreshToken.findMany({
        where: { userId: testUser.id, revoked: false },
      })
      expect(activeBefore).toHaveLength(2)

      // Change role
      await userService.setUserRole(ctx, testUser.id, 'ADMIN')

      // Verify all tokens are revoked
      const activeAfter = await prisma.refreshToken.findMany({
        where: { userId: testUser.id, revoked: false },
      })
      expect(activeAfter).toHaveLength(0)

      const revokedTokens = await prisma.refreshToken.findMany({
        where: { userId: testUser.id, revoked: true },
      })
      expect(revokedTokens).toHaveLength(2)
      expect(revokedTokens.every((token) => token.revokedAt !== null)).toBe(true)
    })

    it('should cache updated token version in Redis', async () => {
      const mockRedisSet = jest.fn().mockResolvedValue('OK')
      const originalSet = ctx.redis.set
      ctx.redis.set = mockRedisSet

      try {
        await userService.setUserRole(ctx, testUser.id, 'ADMIN')

        expect(mockRedisSet).toHaveBeenCalledWith(
          `tv:${testUser.id}`,
          '1', // New token version
          'EX',
          1800
        )
      } finally {
        ctx.redis.set = originalSet
      }
    })

    it('should handle Redis cache failures gracefully', async () => {
      const mockRedisSet = jest.fn().mockRejectedValue(new Error('Redis connection failed'))
      const originalSet = ctx.redis.set
      ctx.redis.set = mockRedisSet

      try {
        // Should not throw even if Redis fails
        const result = await userService.setUserRole(ctx, testUser.id, 'ADMIN')

        expect(result.ok).toBe(true)

        // Verify database changes still happened
        const updatedUser = await prisma.user.findUnique({
          where: { id: testUser.id },
          select: { role: true, tokenVersion: true },
        })
        expect(updatedUser?.role).toBe('ADMIN')
        expect(updatedUser?.tokenVersion).toBe(1)
      } finally {
        ctx.redis.set = originalSet
      }
    })

    it('should throw error for non-existent user', async () => {
      await expect(userService.setUserRole(ctx, 'non-existent-user-id', 'ADMIN')).rejects.toThrow(
        'User not found'
      )
    })

    it('should work when user has no refresh tokens', async () => {
      // Ensure user has no refresh tokens
      const tokensBefore = await prisma.refreshToken.findMany({
        where: { userId: testUser.id },
      })
      expect(tokensBefore).toHaveLength(0)

      const result = await userService.setUserRole(ctx, testUser.id, 'ADMIN')

      expect(result.ok).toBe(true)

      // Verify role change still works
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
        select: { role: true },
      })
      expect(updatedUser?.role).toBe('ADMIN')
    })
  })
})
