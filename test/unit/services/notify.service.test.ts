// test/unit/services/notify.service.test.ts
import { TestDatabase } from '../../helpers/database.helper'
import * as notifyService from '../../../src/services/notify.service'
import type { SyncStats } from '../../../src/types/sync.types'
import type { AppConfig } from '../../../src/config'
import type { FastifyInstance } from 'fastify'

describe('NotifyService', () => {
  let mockApp: FastifyInstance

  beforeAll(async () => {
    await TestDatabase.setup()
  })

  afterAll(async () => {
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()

    // Create mock Fastify app with mailer
    mockApp = {
      config: {
        notifyEmailEnabled: true,
        mailTo: 'test@example.com',
      },
      mailer: {
        send: jest.fn().mockResolvedValue(true),
      },
    } as unknown as FastifyInstance
  })

  describe('sendSyncCompleted', () => {
    const mockStats: SyncStats = {
      pages: 2,
      scanned: 100,
      created: 10,
      updated: 5,
      unchanged: 85,
      softDeleted: 0,
      rateLimitRemaining: 5000,
      startedAt: '2023-01-01T10:00:00Z',
      finishedAt: '2023-01-01T10:05:00Z',
      durationMs: 300000,
    }

    it('should send email when notifications are enabled', async () => {
      await notifyService.sendSyncCompleted(mockApp, 'test-job-123', mockStats)

      expect(mockApp.mailer.send).toHaveBeenCalledWith({
        to: ['test@example.com'],
        subject: '[GitHub Stars] Sync completed — pages:2 scanned:100',
        text: expect.stringContaining('Job test-job-123 completed'),
        html: expect.stringContaining('test-job-123'),
      })
    })

    it('should not send email when notifications are disabled', async () => {
      mockApp.config.notifyEmailEnabled = false

      await notifyService.sendSyncCompleted(mockApp, 'test-job-123', mockStats)

      expect(mockApp.mailer.send).not.toHaveBeenCalled()
    })

    it('should not send email when mailTo is empty', async () => {
      mockApp.config.mailTo = ''

      await notifyService.sendSyncCompleted(mockApp, 'test-job-123', mockStats)

      expect(mockApp.mailer.send).not.toHaveBeenCalled()
    })

    it('should handle multiple email addresses', async () => {
      mockApp.config.mailTo = 'test1@example.com, test2@example.com'

      await notifyService.sendSyncCompleted(mockApp, 'test-job-123', mockStats)

      expect(mockApp.mailer.send).toHaveBeenCalledWith({
        to: ['test1@example.com', 'test2@example.com'],
        subject: '[GitHub Stars] Sync completed — pages:2 scanned:100',
        text: expect.stringContaining('Job test-job-123 completed'),
        html: expect.stringContaining('test-job-123'),
      })
    })
  })

  describe('sendSyncFailed', () => {
    it('should send error email when sync fails', async () => {
      const error = new Error('Sync failed due to API limit')

      await notifyService.sendSyncFailed(mockApp, 'test-job-456', error)

      expect(mockApp.mailer.send).toHaveBeenCalledWith({
        to: ['test@example.com'],
        subject: '[GitHub Stars] Sync failed — job:test-job-456',
        text: expect.stringContaining('Sync failed due to API limit'),
        html: expect.stringContaining('test-job-456'),
      })
    })

    it('should handle non-Error objects', async () => {
      const errorObj = { message: 'Custom error message' }

      await notifyService.sendSyncFailed(mockApp, 'test-job-456', errorObj)

      expect(mockApp.mailer.send).toHaveBeenCalledWith({
        to: ['test@example.com'],
        subject: '[GitHub Stars] Sync failed — job:test-job-456',
        text: expect.stringContaining('Custom error message'),
        html: expect.stringContaining('test-job-456'),
      })
    })

    it('should not send email when notifications are disabled', async () => {
      mockApp.config.notifyEmailEnabled = false

      await notifyService.sendSyncFailed(mockApp, 'test-job-456', new Error('Test error'))

      expect(mockApp.mailer.send).not.toHaveBeenCalled()
    })
  })

  describe('sendMaintenanceCompleted', () => {
    const mockRtSummary = {
      dryRun: false,
      expiredPreview: 10,
      revokedPreview: 5,
      expiredDeleted: 8,
      revokedDeleted: 3,
    }

    const mockBullSummary = {
      dryRun: false,
      queue: 'sync-stars',
      cleanedCompleted: 100,
      cleanedFailed: 5,
      trimmedEventsTo: 500,
      removedRepeatables: 2,
    }

    const mockConfig = { maintCron: '0 3 * * *' } as unknown as AppConfig

    it('should send maintenance completion email', async () => {
      await notifyService.sendMaintenanceCompleted(
        mockApp,
        'maint-job-789',
        mockRtSummary,
        mockBullSummary,
        mockConfig
      )

      expect(mockApp.mailer.send).toHaveBeenCalledWith({
        to: ['test@example.com'],
        subject: '[Maintenance] Daily cleanup completed — rt:11 bull:105',
        text: expect.stringContaining('Job maint-job-789 completed'),
        html: expect.stringContaining('maint-job-789'),
      })
    })
  })

  describe('sendMaintenanceFailed', () => {
    it('should send maintenance failure email', async () => {
      const error = new Error('Maintenance failed')

      await notifyService.sendMaintenanceFailed(mockApp, 'maint-job-789', error)

      expect(mockApp.mailer.send).toHaveBeenCalledWith({
        to: ['test@example.com'],
        subject: '[Maintenance] Daily cleanup failed — job:maint-job-789',
        text: expect.stringContaining('Maintenance failed'),
        html: expect.stringContaining('maint-job-789'),
      })
    })
  })
})
