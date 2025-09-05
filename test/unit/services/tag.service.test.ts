// test/unit/services/tag.service.test.ts
import * as tagService from '../../../src/services/tag.service'
import { TestDatabase } from '../../helpers/database.helper'
import { createMockContext } from '../../helpers/context.helper'
import type { Ctx } from '../../../src/helpers/context.helper'
import { PrismaClient } from '@prisma/client'

describe('TagService', () => {
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

  describe('createTagService', () => {
    it('should create tag with basic data', async () => {
      const tagData = {
        name: 'React',
        description: 'React framework tag',
      }

      const tag = await tagService.createTagService(ctx, tagData)

      expect(tag.name).toBe('React')
      expect(tag.description).toBe('React framework tag')
      expect(tag.archived).toBe(false)
      expect(tag.id).toBeDefined()
      expect(tag.createdAt).toBeDefined()
    })

    it('should create tag without description', async () => {
      const tagData = {
        name: 'Vue',
      }

      const tag = await tagService.createTagService(ctx, tagData)

      expect(tag.name).toBe('Vue')
      expect(tag.description).toBeNull()
      expect(tag.archived).toBe(false)
    })

    it('should throw error for duplicate tag name', async () => {
      const tagData = {
        name: 'Duplicate',
        description: 'First tag',
      }

      await tagService.createTagService(ctx, tagData)

      await expect(
        tagService.createTagService(ctx, {
          name: 'Duplicate',
          description: 'Second tag',
        })
      ).rejects.toThrow('Tag name already exists: Duplicate')
    })

    it('should allow creating tag with same name as archived tag', async () => {
      // 创建并归档一个标签
      const tag = await tagService.createTagService(ctx, {
        name: 'ArchivedTag',
        description: 'To be archived',
      })

      await prisma.tag.update({
        where: { id: tag.id },
        data: { archived: true },
      })

      // 现在应该可以创建同名的新标签
      const newTag = await tagService.createTagService(ctx, {
        name: 'ArchivedTag',
        description: 'New active tag',
      })

      expect(newTag.name).toBe('ArchivedTag')
      expect(newTag.archived).toBe(false)
      expect(newTag.id).not.toBe(tag.id)
    })
  })

  describe('getTagsService', () => {
    beforeEach(async () => {
      // 创建测试数据
      await prisma.tag.createMany({
        data: [
          { name: 'JavaScript', description: 'JS programming language' },
          { name: 'TypeScript', description: 'TS programming language' },
          { name: 'React', description: 'React framework' },
          { name: 'Vue', description: 'Vue framework' },
          { name: 'ArchivedTag', description: 'This is archived', archived: true },
        ],
      })
    })

    it('should return paginated tags', async () => {
      const query = {
        offset: 0,
        limit: 2,
      }

      const result = await tagService.getTagsService(ctx, query)

      expect(result.data).toHaveLength(2)
      expect(result.total).toBe(4) // 不包括已归档的
      expect(result.data[0]).toHaveProperty('id')
      expect(result.data[0]).toHaveProperty('name')
      expect(result.data[0]).toHaveProperty('description')
    })

    it('should exclude archived tags by default', async () => {
      const query = {
        offset: 0,
        limit: 10,
      }

      const result = await tagService.getTagsService(ctx, query)

      expect(result.total).toBe(4)
      expect(result.data.every((tag) => tag.name !== 'ArchivedTag')).toBe(true)
    })

    it('should include archived tags when requested', async () => {
      const query = {
        offset: 0,
        limit: 10,
        archived: true,
      }

      const result = await tagService.getTagsService(ctx, query)

      expect(result.total).toBe(1)
      expect(result.data[0].name).toBe('ArchivedTag')
    })

    it('should support ordering by name', async () => {
      const query = {
        offset: 0,
        limit: 10,
        orderBy: 'name' as const,
        orderDirection: 'asc' as const,
      }

      const result = await tagService.getTagsService(ctx, query)

      const names = result.data.map((tag) => tag.name)
      expect(names).toEqual(['JavaScript', 'React', 'TypeScript', 'Vue'])
    })

    it('should support pagination', async () => {
      const firstPage = await tagService.getTagsService(ctx, {
        offset: 0,
        limit: 2,
        orderBy: 'name' as const,
        orderDirection: 'asc' as const,
      })

      const secondPage = await tagService.getTagsService(ctx, {
        offset: 2,
        limit: 2,
        orderBy: 'name' as const,
        orderDirection: 'asc' as const,
      })

      expect(firstPage.data).toHaveLength(2)
      expect(secondPage.data).toHaveLength(2)
      expect(firstPage.data[0].name).toBe('JavaScript')
      expect(secondPage.data[0].name).toBe('TypeScript')
    })
  })

  describe('getTagByIdService', () => {
    let testTag: { id: string; name: string }
    let testProject: { id: string; name: string }

    beforeEach(async () => {
      // 创建测试标签
      testTag = await prisma.tag.create({
        data: {
          name: 'TestTag',
          description: 'Test tag description',
        },
      })

      // 创建测试项目
      testProject = await prisma.project.create({
        data: {
          githubId: 12345,
          name: 'test-project',
          fullName: 'user/test-project',
          url: 'https://github.com/user/test-project',
        },
      })

      // 关联标签和项目
      await prisma.projectTag.create({
        data: {
          projectId: testProject.id,
          tagId: testTag.id,
        },
      })
    })

    it('should return tag with project relations', async () => {
      const result = await tagService.getTagByIdService(ctx, testTag.id)

      expect(result).toBeDefined()
      expect(result?.id).toBe(testTag.id)
      expect(result?.name).toBe('TestTag')
      expect(result?.description).toBe('Test tag description')
      expect(result?.projects).toHaveLength(1)
      expect(result?.projects[0].id).toBeDefined()
    })

    it('should return null for non-existent tag', async () => {
      const result = await tagService.getTagByIdService(ctx, 'non-existent-id')
      expect(result).toBeNull()
    })

    it('should return null for archived tag', async () => {
      await prisma.tag.update({
        where: { id: testTag.id },
        data: { archived: true },
      })

      const result = await tagService.getTagByIdService(ctx, testTag.id)
      expect(result).toBeNull()
    })

    it('should exclude archived projects from relations', async () => {
      // 归档项目
      await prisma.project.update({
        where: { id: testProject.id },
        data: { archived: true },
      })

      const result = await tagService.getTagByIdService(ctx, testTag.id)

      expect(result).toBeDefined()
      expect(result?.projects).toHaveLength(0)
    })
  })

  describe('updateTagService', () => {
    let testTag: { id: string; name: string }

    beforeEach(async () => {
      testTag = await prisma.tag.create({
        data: {
          name: 'OriginalName',
          description: 'Original description',
        },
      })
    })

    it('should update tag name and description', async () => {
      const updateData = {
        name: 'UpdatedName',
        description: 'Updated description',
      }

      const result = await tagService.updateTagService(ctx, testTag.id, updateData)

      expect(result.name).toBe('UpdatedName')
      expect(result.description).toBe('Updated description')
      expect(result.id).toBe(testTag.id)
    })

    it('should update only description', async () => {
      const updateData = {
        description: 'Only description updated',
      }

      const result = await tagService.updateTagService(ctx, testTag.id, updateData)

      expect(result.name).toBe('OriginalName')
      expect(result.description).toBe('Only description updated')
    })

    it('should throw error for duplicate name with different tag', async () => {
      // 创建另一个标签
      await prisma.tag.create({
        data: { name: 'ExistingName' },
      })

      await expect(
        tagService.updateTagService(ctx, testTag.id, { name: 'ExistingName' })
      ).rejects.toThrow('Tag name already exists: ExistingName')
    })

    it('should allow keeping the same name', async () => {
      const updateData = {
        name: 'OriginalName',
        description: 'Updated description',
      }

      const result = await tagService.updateTagService(ctx, testTag.id, updateData)

      expect(result.name).toBe('OriginalName')
      expect(result.description).toBe('Updated description')
    })

    it('should throw error for name conflict with archived tag', async () => {
      // 创建并归档一个标签
      await prisma.tag.create({
        data: { name: 'ArchivedName', archived: true },
      })

      await expect(
        tagService.updateTagService(ctx, testTag.id, { name: 'ArchivedName' })
      ).rejects.toThrow('Tag name already exists: ArchivedName')
    })
  })

  describe('deleteTagService', () => {
    let testTag: { id: string; name: string }
    let testProject: { id: string; name: string }

    beforeEach(async () => {
      testTag = await prisma.tag.create({
        data: {
          name: 'TagToDelete',
          description: 'Will be deleted',
        },
      })

      testProject = await prisma.project.create({
        data: {
          githubId: 54321,
          name: 'project-with-tag',
          fullName: 'user/project-with-tag',
          url: 'https://github.com/user/project-with-tag',
        },
      })

      // 关联标签和项目
      await prisma.projectTag.create({
        data: {
          projectId: testProject.id,
          tagId: testTag.id,
        },
      })
    })

    it('should archive tag and remove project relations', async () => {
      await tagService.deleteTagService(ctx, testTag.id)

      // 检查标签被归档
      const archivedTag = await prisma.tag.findUnique({
        where: { id: testTag.id },
      })
      expect(archivedTag?.archived).toBe(true)

      // 检查项目标签关联被删除
      const projectTags = await prisma.projectTag.findMany({
        where: { tagId: testTag.id },
      })
      expect(projectTags).toHaveLength(0)
    })

    it('should throw error for non-existent tag', async () => {
      await expect(tagService.deleteTagService(ctx, 'non-existent-id')).rejects.toThrow(
        'Tag not found or archived: non-existent-id'
      )
    })

    it('should throw error for already archived tag', async () => {
      // 先归档标签
      await prisma.tag.update({
        where: { id: testTag.id },
        data: { archived: true },
      })

      await expect(tagService.deleteTagService(ctx, testTag.id)).rejects.toThrow(
        'Tag already archived'
      )
    })
  })
})
