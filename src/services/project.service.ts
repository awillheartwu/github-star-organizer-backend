// src/services/project.service.ts
import { prisma } from '../plugins/prisma'
import { Static } from '@sinclair/typebox'
import { CreateProjectBodySchema } from '../schemas/project.schema'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
// import { Project } from '../generated/prismabox/Project'
// import { mockFromTypeboxSchema } from '../utils/mockTypebox'

type CreateProjectBody = Static<typeof CreateProjectBodySchema>

const IMMUTABLE = new Set(['id', 'createdAt', 'updatedAt', 'lastSyncAt'])

// 标量字段清单（只对这些做差异比对）
const SCALAR_KEYS: Array<keyof CreateProjectBody> = [
  'githubId',
  'name',
  'fullName',
  'url',
  'description',
  'language',
  'stars',
  'forks',
  'lastCommit',
  'notes',
  'favorite',
  'archived',
  'pinned',
  'score',
]

// 幂等：输入数组去重 & 去掉空值
const uniq = <T>(arr: T[]) =>
  Array.from(new Set(arr)).filter((v) => v !== undefined && v !== null && v !== '')

export async function getProjectsService({ offset, limit }: { offset: number; limit: number }) {
  const [data, total] = await Promise.all([
    prisma.project.findMany({
      skip: offset,
      take: limit,
      // orderBy: { createdAt: 'desc' }, // 按需排序
    }),
    prisma.project.count(),
  ])

  /* const mockResponse = mockFromTypeboxSchema(Project)
  console.log(JSON.stringify(mockResponse, null, 2)) */
  return { data, total }
}

export async function getProjectByIdService(id: string) {
  // 可以加 include/tag 等更多字段
  const project = await prisma.project.findUnique({ where: { id } })
  return project
}

export async function createProjectService(body: CreateProjectBody) {
  return await prisma.$transaction(async (tx) => {
    const { tags = [], videoLinks = [], ...projectData } = body

    // 1. 先新建 Project
    const project = await tx.project.create({
      data: {
        ...projectData,
      },
    })

    // 2. tags：查找并建立关联，不存在则新建
    // 假设所有 tag 的 name 唯一
    const tagNames = tags.map((t) => t.name)
    const existedTags = await tx.tag.findMany({ where: { name: { in: tagNames } } })
    const existedTagNames = new Set(existedTags.map((t) => t.name))

    // 需要新建的 tags
    const toCreateTags = tags.filter((t) => !existedTagNames.has(t.name))
    let newTags: typeof existedTags = []
    if (toCreateTags.length) {
      // createMany 不会返回 id，所以还得再查一遍
      await tx.tag.createMany({ data: toCreateTags })
      newTags = await tx.tag.findMany({ where: { name: { in: toCreateTags.map((t) => t.name) } } })
    }

    // 全部 tag id
    const allTags = [...existedTags, ...newTags]

    // 建 ProjectTag 关联
    if (allTags.length) {
      await tx.projectTag.createMany({
        data: allTags.map((t) => ({ projectId: project.id, tagId: t.id })),
      })
    }

    // 批量 videoLinks
    if (videoLinks.length) {
      await tx.videoLink.createMany({
        data: videoLinks.map((link) => ({
          url: link,
          projectId: project.id,
        })),
      })
    }

    // 4. 返回完整的项目（可 include tag/videoLinks）
    const result = await tx.project.findUnique({
      where: { id: project.id },
      include: {
        tags: { include: { tag: true } },
        videoLinks: true,
      },
    })

    return result
  })
}

export async function updateProjectService(id: string, rawBody: Partial<CreateProjectBody>) {
  type UpdateProjectBody = Partial<CreateProjectBody>
  return prisma.$transaction(async (tx) => {
    // 0) 保护：忽略不可变字段
    const body: UpdateProjectBody = { ...rawBody }
    Object.keys(body).forEach((k) => {
      if (IMMUTABLE.has(k)) delete (body as UpdateProjectBody)[k]
    })

    // 1) 取当前数据（含标签/视频）
    const current = await tx.project.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, videoLinks: true },
    })
    if (!current) {
      throw new AppError(
        `Project not found: ${id}`,
        HTTP_STATUS.NOT_FOUND.statusCode,
        ERROR_TYPES.NOT_FOUND,
        { id }
      )
    }

    // 2) 标量差异：只更新有变化的字段
    const scalarUpdate: Record<string, unknown> = {}
    for (const key of SCALAR_KEYS) {
      if (key in body) {
        const incoming = (body as Record<string, unknown>)[key]
        const existing = (current as Record<string, unknown>)[key]
        if (incoming !== undefined && incoming !== existing) {
          scalarUpdate[key] = incoming
        }
      }
    }
    if (Object.keys(scalarUpdate).length) {
      await tx.project.update({ where: { id }, data: scalarUpdate })
    }

    // 3) tags 差异（按 name 幂等）
    if (body.tags) {
      const incomingNames = uniq(body.tags.map((t) => t.name.trim()).filter(Boolean))
      const existingNames = current.tags.map((pt) => pt.tag.name)

      const toAddNames = incomingNames.filter((n) => !existingNames.includes(n))
      const toRemoveNames = existingNames.filter((n) => !incomingNames.includes(n))

      // upsert 每个要新增的 tag（幂等）
      if (toAddNames.length) {
        const addedTags = await Promise.all(
          toAddNames.map((name) => tx.tag.upsert({ where: { name }, update: {}, create: { name } }))
        )
        // 建立关联（去重后的结果，一次性 createMany）
        await tx.projectTag.createMany({
          data: addedTags.map((t) => ({ projectId: id, tagId: t.id })),
        })
      }

      if (toRemoveNames.length) {
        await tx.projectTag.deleteMany({
          where: { projectId: id, tag: { name: { in: toRemoveNames } } },
        })
      }
    }

    // 4) videoLinks 差异（按 url 幂等）
    if (body.videoLinks) {
      const incoming = uniq(body.videoLinks.map((u) => u.trim()).filter(Boolean))
      const existing = current.videoLinks.map((v) => v.url)

      const toAdd = incoming.filter((u) => !existing.includes(u))
      const toRemove = existing.filter((u) => !incoming.includes(u))

      if (toAdd.length) {
        // SQLite 不支持 skipDuplicates；若要彻底幂等可先过滤已存在的，再 createMany
        await tx.videoLink.createMany({
          data: toAdd.map((url) => ({ url, projectId: id })),
        })
      }
      if (toRemove.length) {
        await tx.videoLink.deleteMany({
          where: { projectId: id, url: { in: toRemove } },
        })
      }
    }

    // 5) 返回最新结果（统一结构）
    const result = await tx.project.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, videoLinks: true },
    })
    return result!
  })
}

export async function deleteProjectService(id: string) {
  await prisma.$transaction(async (tx) => {
    // 1) 确认存在
    const existing = await tx.project.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError(
        `Project not found: ${id}`,
        HTTP_STATUS.NOT_FOUND.statusCode,
        ERROR_TYPES.NOT_FOUND,
        { id }
      )
    }

    // 2) 删除关联数据（ProjectTag, VideoLink）
    await Promise.all([
      tx.projectTag.deleteMany({ where: { projectId: id } }),
      tx.videoLink.deleteMany({ where: { projectId: id } }),
    ])

    // 3) 删除 Project
    await tx.project.delete({ where: { id } })
  })
}
