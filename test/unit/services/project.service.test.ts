// test/unit/services/project.service.test.ts
import * as ProjectService from '../../../src/services/project.service'
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'
import { PrismaClient } from '@prisma/client'

describe('ProjectService', () => {
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

  describe('createProjectService', () => {
    it('should create project with basic data', async () => {
      const projectData = {
        githubId: 12345,
        name: 'test-repo',
        fullName: 'user/test-repo',
        url: 'https://github.com/user/test-repo',
        description: 'Test repository',
        language: 'TypeScript',
        stars: 100,
        forks: 10,
      }

      const result = await ProjectService.createProjectService(ctx, projectData)

      expect(result).toMatchObject({
        githubId: 12345,
        name: 'test-repo',
        fullName: 'user/test-repo',
        description: 'Test repository',
        language: 'TypeScript',
        stars: 100,
        forks: 10,
      })
      expect(result.id).toBeDefined()
      expect(result.createdAt).toBeDefined()
    })

    it('should create project with tags and video links', async () => {
      const projectData = {
        githubId: 12346,
        name: 'test-repo-with-tags',
        fullName: 'user/test-repo-with-tags',
        url: 'https://github.com/user/test-repo-with-tags',
        description: 'Test repository with tags',
        language: 'TypeScript',
        stars: 150,
        forks: 20,
        tags: [{ name: 'react', description: 'React framework' }, { name: 'typescript' }],
        videoLinks: ['https://youtube.com/watch?v=abc123', 'https://youtube.com/watch?v=def456'],
      }

      const result = await ProjectService.createProjectService(ctx, projectData)

      expect(result.tags).toHaveLength(2)
      expect(result.tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'react' }),
          expect.objectContaining({ name: 'typescript' }),
        ])
      )
      expect(result.videoLinks).toEqual([
        'https://youtube.com/watch?v=abc123',
        'https://youtube.com/watch?v=def456',
      ])
    })

    it('should throw error for duplicate githubId', async () => {
      const projectData = {
        githubId: 12347,
        name: 'test-duplicate',
        fullName: 'user/test-duplicate',
        url: 'https://github.com/user/test-duplicate',
      }

      await ProjectService.createProjectService(ctx, projectData)

      await expect(ProjectService.createProjectService(ctx, projectData)).rejects.toThrow(
        'Project with githubId 12347 already exists'
      )
    })

    it('should throw error for missing githubId', async () => {
      const projectData = {
        name: 'test-no-github-id',
        fullName: 'user/test-no-github-id',
        url: 'https://github.com/user/test-no-github-id',
      } as Omit<Parameters<typeof ProjectService.createProjectService>[1], 'githubId'>

      // eslint-disable-next-line
      await expect(ProjectService.createProjectService(ctx, projectData as any)).rejects.toThrow(
        'githubId is required'
      )
    })
  })

  describe('getProjectsService', () => {
    beforeEach(async () => {
      await seedTestProjects(prisma)
    })

    it('should return paginated projects', async () => {
      const result = await ProjectService.getProjectsService(ctx, {
        offset: 0,
        limit: 2,
      })

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(3)
    })

    it('should filter projects by language', async () => {
      const result = await ProjectService.getProjectsService(ctx, {
        language: 'TypeScript',
        offset: 0,
        limit: 10,
      })

      expect(result.data).toHaveLength(2)
      expect(result.data.every((p) => p.language === 'TypeScript')).toBe(true)
    })

    it('should search by keyword', async () => {
      const result = await ProjectService.getProjectsService(ctx, {
        keyword: 'react',
        offset: 0,
        limit: 10,
      })

      expect(result.data.length).toBeGreaterThan(0)
      expect(
        result.data.some(
          (p) =>
            p.name.toLowerCase().includes('react') || p.description?.toLowerCase().includes('react')
        )
      ).toBe(true)
    })

    it('should filter by stars range', async () => {
      const result = await ProjectService.getProjectsService(ctx, {
        starsMin: 100,
        starsMax: 200,
        offset: 0,
        limit: 10,
      })

      expect(result.data.every((p) => p.stars >= 100 && p.stars <= 200)).toBe(true)
    })

    it('should filter by forks range', async () => {
      const result = await ProjectService.getProjectsService(ctx, {
        forksMin: 15,
        forksMax: 30,
        offset: 0,
        limit: 10,
      })
      expect(result.data.every((p) => p.forks >= 15 && p.forks <= 30)).toBe(true)
    })

    it('should filter by tagNames', async () => {
      const proj = await prisma.project.findFirst({ where: { name: 'react-app' } })
      const tag = await prisma.tag.create({ data: { name: 'react', description: 'tag' } })
      await prisma.projectTag.create({ data: { projectId: proj!.id, tagId: tag.id } })

      const result = await ProjectService.getProjectsService(ctx, {
        tagNames: ['react'],
        offset: 0,
        limit: 10,
      })
      expect(result.data.length).toBeGreaterThan(0)
      expect(result.data.every((p) => p.tags.some((t) => t.name === 'react'))).toBe(true)
    })

    it('should filter by createdAt range', async () => {
      const old = new Date('2020-01-01T00:00:00Z')
      const recent = new Date()
      const p = await prisma.project.findFirst({ where: { name: 'vue-project' } })
      await prisma.project.update({ where: { id: p!.id }, data: { createdAt: old } })

      const onlyRecent = await ProjectService.getProjectsService(ctx, {
        createdAtStart: new Date(recent.getTime() - 1000).toISOString(),
        offset: 0,
        limit: 10,
      })
      expect(
        onlyRecent.data.every((x) => new Date(x.createdAt) >= new Date(recent.getTime() - 1000))
      ).toBe(true)

      const onlyOld = await ProjectService.getProjectsService(ctx, {
        createdAtEnd: new Date('2020-12-31T23:59:59Z').toISOString(),
        offset: 0,
        limit: 10,
      })
      expect(onlyOld.data.some((x) => x.name === 'vue-project')).toBe(true)
    })

    it('should support languages array filter', async () => {
      const result = await ProjectService.getProjectsService(ctx, {
        languages: ['JavaScript'],
        offset: 0,
        limit: 10,
      })
      expect(result.data.every((p) => p.language === 'JavaScript')).toBe(true)
    })

    it('should filter by favorite and pinned flags', async () => {
      const p = await prisma.project.findFirst({ where: { name: 'angular-demo' } })
      await prisma.project.update({ where: { id: p!.id }, data: { favorite: true, pinned: true } })

      const fav = await ProjectService.getProjectsService(ctx, {
        favorite: true,
        offset: 0,
        limit: 10,
      })
      expect(fav.data.every((x) => x.favorite)).toBe(true)

      const pin = await ProjectService.getProjectsService(ctx, {
        pinned: true,
        offset: 0,
        limit: 10,
      })
      expect(pin.data.every((x) => x.pinned)).toBe(true)
    })

    it('should exclude archived projects by default', async () => {
      // 创建一个归档项目
      await prisma.project.create({
        data: {
          githubId: 9999,
          name: 'archived-project',
          fullName: 'user/archived-project',
          url: 'https://github.com/user/archived-project',
          archived: true,
        },
      })

      const result = await ProjectService.getProjectsService(ctx, {
        offset: 0,
        limit: 10,
      })

      expect(result.data.every((p) => !p.archived)).toBe(true)
    })
  })

  describe('getProjectByIdService', () => {
    it('should return project by id', async () => {
      const project = await prisma.project.create({
        data: {
          githubId: 55555,
          name: 'test-find-by-id',
          fullName: 'user/test-find-by-id',
          url: 'https://github.com/user/test-find-by-id',
          description: 'Find by ID test',
        },
      })

      const result = await ProjectService.getProjectByIdService(ctx, project.id)

      expect(result).toMatchObject({
        id: project.id,
        name: 'test-find-by-id',
        description: 'Find by ID test',
      })
    })

    it('should return null for non-existent project', async () => {
      const result = await ProjectService.getProjectByIdService(ctx, 'non-existent-id')
      expect(result).toBeNull()
    })
  })

  describe('updateProjectService', () => {
    let testProject: { id: string; githubId: number; createdAt: Date }

    beforeEach(async () => {
      testProject = await prisma.project.create({
        data: {
          githubId: 77777,
          name: 'test-update',
          fullName: 'user/test-update',
          url: 'https://github.com/user/test-update',
          description: 'Update test',
          notes: 'Original notes',
          favorite: false,
          pinned: false,
        },
      })
    })

    it('should update editable fields', async () => {
      const updateData = {
        notes: 'Updated notes',
        favorite: true,
        pinned: true,
        score: 5,
      }

      const result = await ProjectService.updateProjectService(ctx, testProject.id, updateData)

      expect(result).toMatchObject({
        notes: 'Updated notes',
        favorite: true,
        pinned: true,
        score: 5,
      })
    })

    it('should ignore immutable fields', async () => {
      const updateData = {
        id: 'new-id',
        githubId: 99999,
        createdAt: new Date(),
        notes: 'Updated notes',
      }

      const result = await ProjectService.updateProjectService(ctx, testProject.id, updateData)

      expect(result.id).toBe(testProject.id)
      expect(result.githubId).toBe(testProject.githubId)
      expect(result.notes).toBe('Updated notes')
    })

    it('should throw error for non-existent project', async () => {
      await expect(
        ProjectService.updateProjectService(ctx, 'non-existent-id', { notes: 'test' })
      ).rejects.toThrow('Project not found or archived')
    })

    it('should update videoLinks add and remove correctly', async () => {
      // seed with two links
      await prisma.videoLink.createMany({
        data: [
          { url: 'https://youtu.be/a', projectId: testProject.id },
          { url: 'https://youtu.be/b', projectId: testProject.id },
        ],
      })

      const result = await ProjectService.updateProjectService(ctx, testProject.id, {
        videoLinks: ['https://youtu.be/b', 'https://youtu.be/c'],
      })

      // Only non-archived links are returned; expect b + c
      const urls = result.videoLinks
      expect(urls.sort()).toEqual(['https://youtu.be/b', 'https://youtu.be/c'].sort())

      // Confirm the removed one got archived
      const aRow = await prisma.videoLink.findFirst({
        where: { projectId: testProject.id, url: 'https://youtu.be/a' },
      })
      expect(aRow?.archived).toBe(true)
      expect(aRow?.deletedAt).not.toBeNull()
    })
  })

  describe('deleteProjectService / archiveAndDeleteProjectById', () => {
    it('should archive snapshot and delete project + relations', async () => {
      const p = await prisma.project.create({
        data: {
          githubId: 88888,
          name: 'del-me',
          fullName: 'user/del-me',
          url: 'https://github.com/user/del-me',
          description: 'to be deleted',
        },
      })

      const tag = await prisma.tag.create({ data: { name: 't1' } })
      await prisma.projectTag.create({ data: { projectId: p.id, tagId: tag.id } })
      await prisma.videoLink.create({ data: { projectId: p.id, url: 'https://youtu.be/x' } })

      await ProjectService.deleteProjectService(ctx, p.id)

      const exists = await prisma.project.findUnique({ where: { id: p.id } })
      expect(exists).toBeNull()

      const archived = await prisma.archivedProject.findMany({ where: { githubId: 88888 } })
      expect(archived.length).toBe(1)

      const ptCount = await prisma.projectTag.count({ where: { projectId: p.id } })
      const vlCount = await prisma.videoLink.count({ where: { projectId: p.id } })
      expect(ptCount).toBe(0)
      expect(vlCount).toBe(0)
    })

    it('should throw when deleting non-existent project', async () => {
      await expect(ProjectService.deleteProjectService(ctx, 'no-such')).rejects.toThrow(
        'Project not found'
      )
    })
  })
})

async function seedTestProjects(prisma: PrismaClient) {
  const projects = [
    {
      githubId: 1001,
      name: 'react-app',
      fullName: 'user/react-app',
      url: 'https://github.com/user/react-app',
      language: 'TypeScript',
      stars: 150,
      forks: 25,
      description: 'A React application with TypeScript',
    },
    {
      githubId: 1002,
      name: 'vue-project',
      fullName: 'user/vue-project',
      url: 'https://github.com/user/vue-project',
      language: 'JavaScript',
      stars: 80,
      forks: 15,
      description: 'A Vue.js project',
    },
    {
      githubId: 1003,
      name: 'angular-demo',
      fullName: 'user/angular-demo',
      url: 'https://github.com/user/angular-demo',
      language: 'TypeScript',
      stars: 120,
      forks: 30,
      description: 'Angular demo application',
    },
  ]

  for (const project of projects) {
    await prisma.project.create({ data: project })
  }
}
