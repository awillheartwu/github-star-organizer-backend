// src/services/project.service.ts
import { prisma } from '../plugins/prisma'
import { Static } from '@sinclair/typebox'
import { CreateProjectBodySchema } from '../schemas/project.schema'
// import { Project } from '../generated/prismabox/Project'
// import { mockFromTypeboxSchema } from '../utils/mockTypebox'

type CreateProjectBody = Static<typeof CreateProjectBodySchema>

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
