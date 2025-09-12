// test/unit/services/ai.service.extra.test.ts
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'
import * as aiService from '../../../src/services/ai.service'
import type { AiCompletion } from '../../../src/services/ai.client'

jest.mock('../../../src/services/ai.client', () => ({
  generateWithProvider: jest.fn(async () => ({
    content: JSON.stringify({ short: 'S', long: 'L', tags: ['web'] }),
    model: 'ai:mock2',
  })),
}))

describe('ai.service additional coverage', () => {
  let ctx: Ctx

  beforeAll(async () => {
    const prisma = await TestDatabase.setup()
    ctx = createMockContext(prisma)
  })

  afterAll(async () => {
    await TestDatabase.cleanup()
  })

  beforeEach(async () => {
    await TestDatabase.clearAll()
    jest.clearAllMocks()
  })

  it('parses fenced JSON from AI output', async () => {
    const project = await ctx.prisma.project.create({
      data: {
        githubId: 8001,
        name: 'fenced-json',
        fullName: 'u/fenced',
        url: 'https://github.com/u/fenced',
      },
    })
    const mod = await import('../../../src/services/ai.client')
    ;(mod.generateWithProvider as unknown as jest.Mock).mockResolvedValueOnce({
      content:
        'noise before\n```json\n{"short":"SF","long":"LF","tags":["React","Tooling"]}\n```\nnoise after',
      model: 'ai:mock2',
    } as AiCompletion)
    const out = await aiService.summarizeProject(ctx, project.id, { createTags: true })
    expect(out.summaryShort).toBe('SF')
    expect(out.summaryLong).toBe('LF')
  })

  it('extracts first JSON object from mixed text', async () => {
    const p = await ctx.prisma.project.create({
      data: {
        githubId: 8002,
        name: 'extract-json',
        fullName: 'u/extract',
        url: 'https://github.com/u/extract',
      },
    })
    const mod = await import('../../../src/services/ai.client')
    ;(mod.generateWithProvider as unknown as jest.Mock).mockResolvedValueOnce({
      content: 'hello world {"short":"S3","tags":["a","b"]} trailing text with } braces',
      model: 'ai:mock2',
    } as AiCompletion)
    const out = await aiService.summarizeProject(ctx, p.id, { createTags: true })
    expect(out.summaryShort).toBe('S3')
    expect(Array.isArray(out.tagsLinked)).toBe(true)
  })

  it('reads README via github.client and caches it when NODE_ENV!=test', async () => {
    const origEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    // mock dynamic import inside fetchReadmeRaw
    jest.doMock('../../../src/services/github/github.client', () => ({
      getRepoReadmeRawByFullName: jest.fn(async () => {
        return '# Title\n\nSome **desc** with code```js\nconsole.log(1)\n``` and [link](https://x) and image ![alt](x)'
      }),
    }))
    const project = await ctx.prisma.project.create({
      data: {
        githubId: 8003,
        name: 'readme-cache',
        fullName: 'u/readme-cache',
        url: 'https://github.com/u/readme-cache',
      },
    })
    const spyRedis = {
      get: jest.fn(async () => null),
      set: jest.fn(async () => 'OK'),
      del: jest.fn(async () => 1),
    }
    const ctx2 = { ...ctx, redis: spyRedis } as Ctx
    const out = await aiService.summarizeProject(ctx2, project.id, {
      includeReadme: true,
      readmeMaxChars: 50,
    })
    expect(out.summaryShort).toBeDefined()
    expect(spyRedis.set).toHaveBeenCalled()
    process.env.NODE_ENV = origEnv
    jest.dontMock('../../../src/services/github/github.client')
  })
})
