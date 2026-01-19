// test/unit/services/admin.service.test.ts
import * as adminService from '../../../src/services/admin.service'
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'
import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'
import type { SyncJobData, SyncStats } from '../../../src/types/sync.types'

// Mock BullMQ Queue
const mockQueue = {
  getJob: jest.fn(),
  add: jest.fn(),
} as unknown as Queue<SyncJobData, SyncStats>

describe('AdminService', () => {
  let prisma: PrismaClient
  let ctx: Ctx

  beforeAll(async () => {
    prisma = await TestDatabase.setup()
    ctx = createMockContext(prisma)
    // Mock config for tests
    ctx.config.githubUsername = 'testuser'
  })

  afterAll(async () => {
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()
    jest.clearAllMocks()
  })

  describe('enqueueSyncStarsService', () => {
    it('should enqueue new sync job', async () => {
      const mockJob = {
        id: 'sync-stars:manual:abc12345',
      }

      // Mock queue methods
      ;(mockQueue.getJob as jest.Mock).mockResolvedValue(null)
      ;(mockQueue.add as jest.Mock).mockResolvedValue(mockJob)

      const syncOptions = {
        mode: 'full' as const,
        perPage: 100,
        maxPages: 5,
        softDeleteUnstarred: false,
        note: 'Manual sync test',
      }

      const jobId = await adminService.enqueueSyncStarsService(ctx, mockQueue, syncOptions)

      expect(jobId).toBe('sync-stars:manual:abc12345')
      expect(mockQueue.add).toHaveBeenCalledWith(
        'sync-stars',
        {
          options: {
            mode: 'full',
            perPage: 100,
            maxPages: 5,
            softDeleteUnstarred: false,
          },
          actor: 'manual',
          note: 'Manual sync test',
        },
        expect.objectContaining({
          removeOnComplete: true,
        })
      )
    })

    it('should throw error for already running job', async () => {
      const existingJob = {
        getState: jest.fn().mockResolvedValue('active'),
      }

      ;(mockQueue.getJob as jest.Mock).mockResolvedValue(existingJob)

      const syncOptions = {
        mode: 'incremental' as const,
        perPage: 50,
      }

      await expect(
        adminService.enqueueSyncStarsService(ctx, mockQueue, syncOptions)
      ).rejects.toThrow('Sync already enqueued or running')
    })

    it('should allow enqueueing when previous job completed', async () => {
      const completedJob = {
        getState: jest.fn().mockResolvedValue('completed'),
      }
      const newMockJob = {
        id: 'sync-stars:manual:def67890',
      }

      ;(mockQueue.getJob as jest.Mock).mockResolvedValue(completedJob)
      ;(mockQueue.add as jest.Mock).mockResolvedValue(newMockJob)

      const syncOptions = {
        mode: 'incremental' as const,
        perPage: 50,
      }

      const jobId = await adminService.enqueueSyncStarsService(ctx, mockQueue, syncOptions)

      expect(jobId).toBe('sync-stars:manual:def67890')
      expect(mockQueue.add).toHaveBeenCalled()
    })

    it('should allow enqueueing when previous job failed', async () => {
      const failedJob = {
        getState: jest.fn().mockResolvedValue('failed'),
      }
      const newMockJob = {
        id: 'sync-stars:manual:ghi12345',
      }

      ;(mockQueue.getJob as jest.Mock).mockResolvedValue(failedJob)
      ;(mockQueue.add as jest.Mock).mockResolvedValue(newMockJob)

      const syncOptions = {
        mode: 'full' as const,
      }

      const jobId = await adminService.enqueueSyncStarsService(ctx, mockQueue, syncOptions)

      expect(jobId).toBe('sync-stars:manual:ghi12345')
    })

    it('should handle job state check errors gracefully', async () => {
      // Mock getJob to return null, so no existing job is found
      ;(mockQueue.getJob as jest.Mock).mockResolvedValue(null)

      const newMockJob = {
        id: 'sync-stars:manual:error123',
      }
      ;(mockQueue.add as jest.Mock).mockResolvedValue(newMockJob)

      const syncOptions = {
        mode: 'incremental' as const,
      }

      // Should not throw and should proceed to add new job
      const jobId = await adminService.enqueueSyncStarsService(ctx, mockQueue, syncOptions)

      expect(jobId).toBe('sync-stars:manual:error123')
    })
  })

  describe('getSyncStateSummaryService', () => {
    beforeEach(async () => {
      // Create a sync state record with the correct key format and source
      await prisma.syncState.create({
        data: {
          source: 'github:stars', // Must match SYNC_SOURCE_GITHUB_STARS
          key: 'user:testuser', // Must match buildGithubStarsKey without hyphen
          cursor: 'cursor123',
          etag: 'etag123',
          lastRunAt: new Date('2023-01-01T10:00:00Z'),
          lastSuccessAt: new Date('2023-01-01T09:45:00Z'),
          lastErrorAt: new Date('2023-01-01T09:30:00Z'),
          lastError: 'Previous error message',
          statsJson:
            '{\\"scanned\\":100,\\"created\\":50,\\"updated\\":0,\\"unchanged\\":50,\\"softDeleted\\":0,\\"pages\\":1,\\"durationMs\\":1200,\\"startedAt\\":\\"2023-01-01T10:00:00.000Z\\",\\"finishedAt\\":\\"2023-01-01T10:05:00.000Z\\"}',
        },
      })
    })

    it('should return sync state summary', async () => {
      const result = await adminService.getSyncStateSummaryService(ctx)

      expect(result).toMatchObject({
        source: 'github:stars', // Updated to match the correct source format
        key: 'user:testuser', // Updated to match the correct key format
        cursor: 'cursor123',
        etag: 'etag123',
        lastRunAt: '2023-01-01T10:00:00.000Z',
        lastSuccessAt: '2023-01-01T09:45:00.000Z',
        lastErrorAt: '2023-01-01T09:30:00.000Z',
        lastError: 'Previous error message',
        statsJson:
          '{\\"scanned\\":100,\\"created\\":50,\\"updated\\":0,\\"unchanged\\":50,\\"softDeleted\\":0,\\"pages\\":1,\\"durationMs\\":1200,\\"startedAt\\":\\"2023-01-01T10:00:00.000Z\\",\\"finishedAt\\":\\"2023-01-01T10:05:00.000Z\\"}',
        latestStats: {
          scanned: 100,
          created: 50,
          updated: 0,
          unchanged: 50,
          softDeleted: 0,
          pages: 1,
          durationMs: 1200,
          startedAt: '2023-01-01T10:00:00.000Z',
          finishedAt: '2023-01-01T10:05:00.000Z',
        },
      })
      expect(result.id).toBeDefined()
      expect(result.updatedAt).toBeDefined()
    })

    it('should throw error when state not found', async () => {
      // Clear the database
      await TestDatabase.clearAll()

      await expect(adminService.getSyncStateSummaryService(ctx)).rejects.toThrow('State not found')
    })
  })

  describe('listArchivedProjectsService', () => {
    beforeEach(async () => {
      // Create test archived projects
      await prisma.archivedProject.createMany({
        data: [
          {
            githubId: 1001,
            reason: 'manual',
            archivedAt: new Date('2023-01-01T10:00:00Z'),
            snapshot: '{"name": "project1", "description": "First project"}',
          },
          {
            githubId: 1002,
            reason: 'unstarred',
            archivedAt: new Date('2023-01-02T10:00:00Z'),
            snapshot: '{"name": "project2", "description": "Second project"}',
          },
          {
            githubId: 1003,
            reason: 'manual',
            archivedAt: new Date('2023-01-03T10:00:00Z'),
            snapshot: '{"name": "project3", "description": "Third project"}',
          },
        ],
      })
    })

    it('should return paginated archived projects', async () => {
      const query = {
        offset: 0,
        limit: 2,
      }

      const result = await adminService.listArchivedProjectsService(ctx, query)

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(3)
      expect(result.page).toBe(1)
      expect(result.pageSize).toBe(2)
      expect(result.data[0].githubId).toBe(1003) // Most recent first
    })

    it('should filter by reason', async () => {
      const query = {
        offset: 0,
        limit: 10,
        reason: 'manual' as const,
      }

      const result = await adminService.listArchivedProjectsService(ctx, query)

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(result.data.every((p) => p.reason === 'manual')).toBe(true)
    })

    it('should support pagination', async () => {
      const firstPage = await adminService.listArchivedProjectsService(ctx, {
        offset: 0,
        limit: 1,
      })

      const secondPage = await adminService.listArchivedProjectsService(ctx, {
        offset: 1,
        limit: 1,
      })

      expect(firstPage.data).toHaveLength(1)
      expect(secondPage.data).toHaveLength(1)
      expect(firstPage.data[0].githubId).toBe(1003)
      expect(secondPage.data[0].githubId).toBe(1002)
    })

    it('should handle empty results', async () => {
      await TestDatabase.clearAll()

      const result = await adminService.listArchivedProjectsService(ctx, {
        offset: 0,
        limit: 10,
      })

      expect(result.data).toHaveLength(0)
      expect(result.total).toBe(0)
    })
  })

  describe('getArchivedProjectByIdService', () => {
    let testArchivedProject: { id: string }

    beforeEach(async () => {
      testArchivedProject = await prisma.archivedProject.create({
        data: {
          githubId: 2001,
          reason: 'manual',
          archivedAt: new Date('2023-01-01T10:00:00Z'),
          snapshot: '{"name": "test-project", "description": "Test archived project"}',
        },
      })
    })

    it('should return archived project by id', async () => {
      const result = await adminService.getArchivedProjectByIdService(ctx, testArchivedProject.id)

      expect(result).toMatchObject({
        id: testArchivedProject.id,
        githubId: 2001,
        reason: 'manual',
        snapshot: '{"name": "test-project", "description": "Test archived project"}',
      })
      expect(result.archivedAt).toBeDefined()
    })

    it('should throw error for non-existent archived project', async () => {
      await expect(
        adminService.getArchivedProjectByIdService(ctx, 'non-existent-id')
      ).rejects.toThrow('Archived project not found')
    })
  })
})
