// src/services/project.service.ts
import { Static } from '@sinclair/typebox'
import { ProjectQuerySchema, CreateProjectBodySchema } from '../schemas/project.schema'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import type { ProjectWithRelations } from '../helpers/transform.helper'
import { toProjectDto, toProjectDtos } from '../helpers/transform.helper'
import { Project } from '@prisma/client'
import { Ctx } from '../helpers/context.helper'
// import { Project } from '../generated/prismabox/Project'
// import { mockFromTypeboxSchema } from '../utils/mockTypebox'

type ProjectQuery = Static<typeof ProjectQuerySchema> & { offset: number; limit: number }
type CreateProjectBody = Static<typeof CreateProjectBodySchema>

const IMMUTABLE = new Set(['id', 'githubId', 'createdAt', 'updatedAt', 'lastSyncAt'])

// 组装排序条件
const ORDERABLE = new Set<keyof Project>([
  'createdAt',
  'updatedAt',
  'stars',
  'forks',
  'lastCommit',
  'lastSyncAt',
  'name',
])

// 标量字段清单（只对这些做差异比对）
const SCALAR_KEYS: Array<keyof CreateProjectBody> = [
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

export async function getProjectsService(ctx: Ctx, query: ProjectQuery) {
  const {
    name,
    keyword,
    language,
    languages,
    favorite,
    pinned,
    archived, // 布尔开关，可选
    starsMin,
    starsMax,
    forksMin,
    forksMax,
    tagNames, // string[] 按标签筛选
    createdAtStart,
    createdAtEnd,
    updatedAtStart,
    updatedAtEnd,
    orderBy,
    orderDirection,
    offset,
    limit,
  } = query

  const conditions: Record<string, unknown> = {}
  // 归档开关
  conditions.archived = archived ?? false

  // 是否喜欢和是否置顶
  if (favorite !== undefined) conditions.favorite = !!favorite
  if (pinned !== undefined) conditions.pinned = !!pinned

  // 语言
  if (language) conditions.language = { equals: language, mode: 'insensitive' }
  if (languages?.length) conditions.language = { in: languages, mode: 'insensitive' }

  // 名称模糊搜索
  if (name) conditions.name = { contains: name, mode: 'insensitive' }

  // 关键词搜索
  if (keyword) {
    // 统一关键词：name / fullName / description
    conditions.OR = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { fullName: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
    ]
  }

  // 星标/分叉 数量区间
  if (starsMin !== undefined || starsMax !== undefined) {
    conditions.stars = {}
    if (starsMin !== undefined) conditions.stars['gte'] = Number(starsMin)
    if (starsMax !== undefined) conditions.stars['lte'] = Number(starsMax)
  }
  if (forksMin !== undefined || forksMax !== undefined) {
    conditions.forks = {}
    if (forksMin !== undefined) conditions.forks['gte'] = Number(forksMin)
    if (forksMax !== undefined) conditions.forks['lte'] = Number(forksMax)
  }

  // 创建/更新时间范围
  if (createdAtStart || createdAtEnd) {
    conditions['createdAt'] = {}
    if (createdAtStart) conditions['createdAt']['gte'] = new Date(createdAtStart)
    if (createdAtEnd) conditions['createdAt']['lte'] = new Date(createdAtEnd)
  }
  if (updatedAtStart || updatedAtEnd) {
    conditions['updatedAt'] = {}
    if (updatedAtStart) conditions['updatedAt']['gte'] = new Date(updatedAtStart)
    if (updatedAtEnd) conditions['updatedAt']['lte'] = new Date(updatedAtEnd)
  }

  // 按标签筛选（多对多）
  if (tagNames?.length) {
    conditions.tags = {
      some: {
        tag: { name: { in: tagNames }, archived: false },
      },
    }
  }

  const order: Record<string, 'asc' | 'desc'> = {}
  if (orderBy && ORDERABLE.has(orderBy)) {
    order[orderBy] = orderDirection || 'asc'
  } else {
    order['createdAt'] = 'desc' // 默认
  }

  ctx.log.debug('conditions', JSON.stringify(conditions, null, 2))
  ctx.log.debug('order', order, { offset, limit })

  // 同时执行查询和计数
  const [data, total] = await Promise.all([
    ctx.prisma.project.findMany({
      skip: offset,
      take: limit,
      where: conditions,
      orderBy: order,
      include: {
        tags: {
          where: { tag: { archived: false } },
          include: { tag: { select: { id: true, name: true, description: true } } },
        },
        videoLinks: { where: { archived: false }, select: { id: true, url: true } },
      },
    }),
    ctx.prisma.project.count({ where: conditions }),
  ])

  // 脱壳
  const flatData = toProjectDtos(data as unknown as ProjectWithRelations[])

  // 返回结果
  const result = { data: flatData, total }

  // 仅用于生成 Mock 数据
  /* const mockResponse = mockFromTypeboxSchema(Project)
  console.log(JSON.stringify(mockResponse, null, 2)) */
  return result
}

export async function getProjectByIdService(ctx: Ctx, id: string) {
  const project = await ctx.prisma.project.findUnique({
    where: { id },
    include: {
      tags: {
        where: { tag: { archived: false } },
        include: { tag: { select: { id: true, name: true, description: true } } },
      },
      videoLinks: { where: { archived: false }, select: { id: true, url: true } },
    },
  })
  if (!project) return null
  ctx.log.debug('Project found:', project)
  // 脱壳
  return toProjectDto(project as unknown as ProjectWithRelations)
}

export async function createProjectService(ctx: Ctx, body: CreateProjectBody) {
  return await ctx.prisma.$transaction(async (tx) => {
    const { tags = [], videoLinks = [], ...projectData } = body
    // 0.根剧 githubId 保护幂等
    if (!projectData.githubId) {
      throw new AppError(
        `githubId is required`,
        HTTP_STATUS.BAD_REQUEST.statusCode,
        ERROR_TYPES.VALIDATION,
        {}
      )
    }
    const existing = await tx.project.findUnique({
      where: { githubId: projectData.githubId },
    })
    if (existing) {
      throw new AppError(
        `Project with githubId ${projectData.githubId} already exists`,
        HTTP_STATUS.CONFLICT.statusCode,
        ERROR_TYPES.CONFLICT,
        { githubId: projectData.githubId }
      )
    }
    // 1. 先新建 Project
    const project = await tx.project.create({
      data: {
        ...projectData,
      },
    })

    // 2. tags：查找并建立关联，不存在则新建
    // 假设所有 tag 的 name 唯一
    const tagNames = tags.map((t) => t.name)
    const existedTags = await tx.tag.findMany({
      where: { name: { in: tagNames }, archived: false },
    })
    const existedTagNames = new Set(existedTags.map((t) => t.name))

    // 需要新建的 tags,并去掉 id
    const toCreateTags = tags
      .filter((t) => !existedTagNames.has(t.name))
      .map((t) => ({ name: t.name, description: t.description || '' }))
    let newTags: typeof existedTags = []
    if (toCreateTags.length) {
      // createMany 不会返回 id，所以还得再查一遍
      newTags = await tx.tag.createManyAndReturn({ data: toCreateTags })
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
        tags: {
          where: { tag: { archived: false } },
          include: { tag: true },
        },
        videoLinks: { where: { archived: false }, select: { id: true, url: true } },
      },
    })
    ctx.log.debug('Project created:', result)

    return toProjectDto(result as unknown as ProjectWithRelations)
  })
}

export async function updateProjectService(
  ctx: Ctx,
  id: string,
  rawBody: Partial<CreateProjectBody>
) {
  type UpdateProjectBody = Partial<CreateProjectBody>
  return ctx.prisma.$transaction(async (tx) => {
    // 0) 保护：忽略不可变字段
    const body: UpdateProjectBody = { ...rawBody }
    Object.keys(body).forEach((k) => {
      if (IMMUTABLE.has(k)) delete (body as UpdateProjectBody)[k]
    })

    // 1) 取当前数据（含标签/视频）
    const current = await tx.project.findUnique({
      where: { id },
      include: {
        tags: {
          where: { tag: { archived: false } },
          include: { tag: true },
        },
        videoLinks: { where: { archived: false } },
      },
    })
    if (!current) {
      throw new AppError(
        `Project not found or archived: ${id}`,
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
        // a) 一次查已有
        const existed = await tx.tag.findMany({
          where: { name: { in: toAddNames }, archived: false },
          select: { id: true, name: true },
        })
        const existedNames = new Set(existed.map((t) => t.name))

        // b) 差集，一次 createManyAndReturn
        const toCreate = toAddNames.filter((n) => !existedNames.has(n)).map((n) => ({ name: n }))

        const created = toCreate.length
          ? await tx.tag.createManyAndReturn({
              data: toCreate,
              select: { id: true, name: true },
            })
          : []

        // c) 合并结果后，一次性建关联
        const all = [...existed, ...created]
        if (all.length) {
          await tx.projectTag.createMany({
            data: all.map((t) => ({ projectId: id, tagId: t.id })),
          })
        }
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
        await tx.videoLink.updateMany({
          where: { projectId: id, url: { in: toRemove } },
          data: { archived: true, deletedAt: new Date() },
        })
      }
    }

    // 5) 返回最新结果（统一结构）
    const result = await tx.project.findUnique({
      where: { id },
      include: {
        tags: {
          where: { tag: { archived: false } },
          include: { tag: true },
        },
        videoLinks: { where: { archived: false } },
      },
    })

    // 6) 脱壳
    if (!result) {
      throw new AppError(
        `Project not found after update: ${id}`,
        HTTP_STATUS.NOT_FOUND.statusCode,
        ERROR_TYPES.NOT_FOUND,
        { id }
      )
    }
    ctx.log.debug('Project updated:', result)
    return toProjectDto(result as unknown as ProjectWithRelations)
  })
}

export async function deleteProjectService(ctx: Ctx, id: string) {
  await ctx.prisma.$transaction(async (tx) => {
    // 1) 确认存在
    const existing = await tx.project.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError(
        `Project not found or archived: ${id}`,
        HTTP_STATUS.NOT_FOUND.statusCode,
        ERROR_TYPES.NOT_FOUND,
        { id }
      )
    }

    // 2) 删除关联数据（ProjectTag, VideoLink）
    await Promise.all([
      tx.projectTag.deleteMany({ where: { projectId: id } }),
      tx.videoLink.updateMany({
        where: { projectId: id, archived: false },
        data: { archived: true, deletedAt: new Date() },
      }),
    ])

    // 3) 删除 Project
    await tx.project.update({
      where: { id },
      data: { archived: true, deletedAt: new Date() },
    })
    ctx.log.debug('Project archived:', id)
  })
}
