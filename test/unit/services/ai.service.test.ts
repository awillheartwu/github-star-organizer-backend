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
})
