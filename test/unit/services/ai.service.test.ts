// test/unit/services/ai.service.test.ts
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'

// Mock ai.client to return deterministic JSON
jest.mock('../../../src/services/ai.client', () => ({
  generateWithProvider: jest.fn(async () => ({
    content: JSON.stringify({
      short: '短摘要',
      long: '长摘要',
      tags: ['AI', 'Fastify', 'typescript'],
    }),
    model: 'ai:mock',
  })),
}))

import * as aiService from '../../../src/services/ai.service'
import type { AiCompletion } from '../../../src/services/ai.client'
import { PrismaClient } from '@prisma/client'

describe('ai.service summarizeProject', () => {
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

  it('should create history rows and attach tags', async () => {
    const project = await prisma.project.create({
      data: {
        githubId: 6001,
        name: 'ai-target',
        fullName: 'user/ai-target',
        url: 'https://github.com/user/ai-target',
        description: 'project for ai summary',
      },
    })

    const res = await aiService.summarizeProject(ctx, project.id, {
      style: 'both',
      lang: 'zh',
      createTags: true,
    })

    expect(res.summaryShort).toBeDefined()
    expect(res.summaryLong).toBeDefined()
    expect(res.model).toBe('ai:mock')

    // AiSummary history inserted
    const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(
      'SELECT COUNT(1) as count FROM "AiSummary" WHERE projectId = ?',
      project.id
    )
    expect(Number(rows[0].count)).toBeGreaterThanOrEqual(1)

    // tags attached
    const tags = await prisma.projectTag.findMany({ where: { projectId: project.id } })
    expect(tags.length).toBeGreaterThan(0)
  })

  it('should clean and dedupe tag names, ignore too-long ones, and create when archived exists', async () => {
    const project = await prisma.project.create({
      data: {
        githubId: 7001,
        name: 'tag-target',
        fullName: 'u/tag-target',
        url: 'https://github.com/u/tag-target',
      },
    })

    // Pre-create an archived tag with name 'ai' -> attachTags should create a fresh active one
    const archived = await prisma.tag.create({ data: { name: 'ai', archived: true } })
    expect(archived.archived).toBe(true)

    const mod = await import('../../../src/services/ai.client')
    jest.spyOn(mod, 'generateWithProvider').mockResolvedValueOnce({
      content: JSON.stringify({
        short: 'S',
        tags: [
          'AI',
          'ai',
          'typescript',
          'typescript',
          'this-tag-name-is-way-too-very-very-long-over-32',
        ],
      }),
    } as AiCompletion)

    const r = await aiService.summarizeProject(ctx, project.id, { createTags: true })
    // cleaned to lower-case unique <=32
    expect(r.tagsLinked.sort()).toEqual(['ai', 'typescript'])
  })

  it('should succeed when provider returns JSON without tags', async () => {
    const p = await prisma.project.create({
      data: {
        githubId: 7002,
        name: 'no-tags',
        fullName: 'u/no-tags',
        url: 'https://github.com/u/no-tags',
      },
    })
    const mod = await import('../../../src/services/ai.client')
    jest
      .spyOn(mod, 'generateWithProvider')
      .mockResolvedValueOnce({ content: JSON.stringify({ short: 'S' }) } as AiCompletion)
    const r = await aiService.summarizeProject(ctx, p.id, { createTags: true })
    expect(r.summaryShort).toBe('S')
    expect(r.tagsLinked).toEqual([])
  })

  it('should throw when project not found or archived', async () => {
    await expect(aiService.summarizeProject(ctx, 'no-such')).rejects.toThrow(
      'Project not found or archived'
    )

    const p = await prisma.project.create({
      data: {
        githubId: 6002,
        name: 'archived-proj',
        fullName: 'user/archived-proj',
        url: 'https://github.com/user/archived-proj',
        archived: true,
      },
    })
    await expect(aiService.summarizeProject(ctx, p.id)).rejects.toThrow('Project not found')
  })

  it('should respect style short/long and not create tags when disabled', async () => {
    const mod = await import('../../../src/services/ai.client')
    // Only short in payload
    jest.spyOn(mod, 'generateWithProvider').mockResolvedValueOnce({
      content: JSON.stringify({ short: 'S', tags: ['x', 'y'] }),
    } as AiCompletion)

    const p1 = await prisma.project.create({
      data: {
        githubId: 6003,
        name: 'only-short',
        fullName: 'user/only-short',
        url: 'https://github.com/user/only-short',
      },
    })
    const r1 = await aiService.summarizeProject(ctx, p1.id, {
      style: 'short',
      createTags: false,
    })
    expect(r1.summaryShort).toBe('S')
    expect(r1.summaryLong).toBeUndefined()
    expect(r1.tagsCreated).toEqual([])
    expect(r1.tagsLinked).toEqual([])

    // Only long in payload
    jest
      .spyOn(mod, 'generateWithProvider')
      .mockResolvedValueOnce({ content: JSON.stringify({ long: 'L' }) } as AiCompletion)
    const p2 = await prisma.project.create({
      data: {
        githubId: 6004,
        name: 'only-long',
        fullName: 'user/only-long',
        url: 'https://github.com/user/only-long',
      },
    })
    const r2 = await aiService.summarizeProject(ctx, p2.id, { style: 'long', createTags: false })
    expect(r2.summaryShort).toBeUndefined()
    expect(r2.summaryLong).toBe('L')
  })

  it('should update latest summaries on project record', async () => {
    const p = await prisma.project.create({
      data: {
        githubId: 6005,
        name: 'update-fields',
        fullName: 'user/update-fields',
        url: 'https://github.com/user/update-fields',
      },
    })
    await aiService.summarizeProject(ctx, p.id, { style: 'both' })
    const after = await prisma.project.findUnique({ where: { id: p.id } })
    expect(after?.summaryShort).toBeTruthy()
    expect(after?.summaryLong).toBeTruthy()
  })

  it('should throw when AI returns invalid JSON', async () => {
    const mod = await import('../../../src/services/ai.client')
    jest
      .spyOn(mod, 'generateWithProvider')
      .mockResolvedValueOnce({ content: 'oops' } as AiCompletion)

    const p = await prisma.project.create({
      data: {
        githubId: 6006,
        name: 'invalid-json',
        fullName: 'user/invalid-json',
        url: 'https://github.com/user/invalid-json',
      },
    })
    await expect(aiService.summarizeProject(ctx, p.id)).rejects.toThrow(
      'AI response is not valid JSON'
    )
  })
})
