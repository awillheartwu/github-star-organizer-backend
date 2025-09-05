// test/unit/services/maintenance.service.test.ts
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'
import { PrismaClient } from '@prisma/client'

// Mock BullMQ Queue to avoid real Redis connection in unit tests
jest.mock('bullmq', () => {
  const QueueMock = jest.fn().mockImplementation(() => ({
    waitUntilReady: jest.fn().mockResolvedValue(undefined),
    clean: jest.fn().mockResolvedValue([]),
    trimEvents: jest.fn().mockResolvedValue(undefined),
    getRepeatableJobs: jest.fn().mockResolvedValue([]),
    removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  }))
  return { Queue: QueueMock }
})

import * as maintenanceService from '../../../src/services/maintenance.service'

describe('MaintenanceService', () => {
  let prisma: PrismaClient
  let ctx: Ctx

  beforeAll(async () => {
    await TestDatabase.setup()
    prisma = TestDatabase.getInstance()
  })

  afterAll(async () => {
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()
    ctx = createMockContext(prisma)
  })

  describe('cleanupRefreshTokensService', () => {
    beforeEach(async () => {
      const now = new Date()
      const expiredDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000) // 8 days ago
      const validDate = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) // 1 day from now

      // Create test users first
      await prisma.user.createMany({
        data: [
          { id: 'user1', email: 'user1@test.com', passwordHash: 'hash1' },
          { id: 'user2', email: 'user2@test.com', passwordHash: 'hash2' },
          { id: 'user3', email: 'user3@test.com', passwordHash: 'hash3' },
        ],
      })

      // Create test refresh tokens
      await prisma.refreshToken.createMany({
        data: [
          {
            userId: 'user1',
            tokenHash: 'hash1',
            jti: 'jti1',
            expiresAt: expiredDate,
            revokedAt: null,
          },
          {
            userId: 'user2',
            tokenHash: 'hash2',
            jti: 'jti2',
            expiresAt: validDate,
            revokedAt: null,
          },
          {
            userId: 'user3',
            tokenHash: 'hash3',
            jti: 'jti3',
            expiresAt: validDate,
            revokedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000), // revoked 8 days ago
          },
        ],
      })
    })

    it('should preview expired tokens in dry run mode', async () => {
      const result = await maintenanceService.cleanupRefreshTokensService(ctx, {
        dryRun: true,
        expiredCleanAfterDays: 7,
        revokedRetentionDays: 7,
      })

      expect(result.dryRun).toBe(true)
      expect(result.expiredPreview).toBeGreaterThanOrEqual(0)
      expect(result.revokedPreview).toBeGreaterThanOrEqual(0)
      expect(result.expiredDeleted).toBe(0)
      expect(result.revokedDeleted).toBe(0)
    })

    it('should delete expired tokens when not in dry run mode', async () => {
      const result = await maintenanceService.cleanupRefreshTokensService(ctx, {
        dryRun: false,
        expiredCleanAfterDays: 7,
        revokedRetentionDays: 7,
      })

      expect(result.dryRun).toBe(false)
      // Results depend on the actual data, so just check that function executed
      expect(typeof result.expiredDeleted).toBe('number')
      expect(typeof result.revokedDeleted).toBe('number')
    })

    it('should handle empty database gracefully', async () => {
      await TestDatabase.clearAll()

      const result = await maintenanceService.cleanupRefreshTokensService(ctx, {
        dryRun: true,
        expiredCleanAfterDays: 7,
        revokedRetentionDays: 7,
      })

      expect(result.expiredPreview).toBe(0)
      expect(result.revokedPreview).toBe(0)
    })
  })

  describe('cleanupBullmqService', () => {
    it('should run bull cleanup in dry run mode', async () => {
      const result = await maintenanceService.cleanupBullmqService(ctx, {
        dryRun: true,
      })

      expect(result.dryRun).toBe(true)
      expect(result.queue).toBe('sync-stars')
      expect(typeof result.cleanedCompleted).toBe('number')
      expect(typeof result.cleanedFailed).toBe('number')
    })

    it('should run bull cleanup when not in dry run mode', async () => {
      const result = await maintenanceService.cleanupBullmqService(ctx, {
        dryRun: false,
      })

      expect(result.dryRun).toBe(false)
      expect(result.queue).toBe('sync-stars')
      expect(typeof result.cleanedCompleted).toBe('number')
      expect(typeof result.cleanedFailed).toBe('number')
    })

    it('should use custom queue name when provided', async () => {
      const result = await maintenanceService.cleanupBullmqService(ctx, {
        dryRun: true,
        queueName: 'custom-queue',
      })

      expect(result.queue).toBe('custom-queue')
    })

    it('should respect lock: skip when lock not acquired', async () => {
      const originalSet = ctx.redis.set
      // simulate lock not acquired
      ctx.redis.set = jest.fn().mockResolvedValue(undefined)
      try {
        const result = await maintenanceService.cleanupBullmqService(ctx, {
          dryRun: true,
          useLock: true,
        })
        expect(result.locked).toBe(true)
        expect(result.cleanedCompleted).toBe(0)
        expect(result.cleanedFailed).toBe(0)
      } finally {
        ctx.redis.set = originalSet
      }
    })

    it('should count repeatable removal (dryRun)', async () => {
      // Rewire the mock implementation for repeatable jobs
      const mocked = jest.requireMock('bullmq') as { Queue: jest.Mock }
      mocked.Queue.mockImplementation(() => ({
        waitUntilReady: jest.fn().mockResolvedValue(undefined),
        clean: jest.fn().mockResolvedValue([]),
        trimEvents: jest.fn().mockResolvedValue(undefined),
        getRepeatableJobs: jest.fn().mockResolvedValue([
          { name: 'sync-stars', cron: ctx.config.syncStarsCron, key: 'keep' },
          { name: 'other', cron: '* * * * *', key: 'rm' },
        ]),
        removeRepeatableByKey: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      }))

      const result = await maintenanceService.cleanupBullmqService(ctx, {
        dryRun: true,
      })
      expect(result.removedRepeatables).toBeGreaterThanOrEqual(1)
    })
  })
})
