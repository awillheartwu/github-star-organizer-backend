// src/services/project.service.ts
import { Static } from '@sinclair/typebox'
import { ProjectQuerySchema, CreateProjectBodySchema } from '../schemas/project.schema'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import type { ProjectWithRelations } from '../helpers/transform.helper'
import { toProjectDto, toProjectDtos } from '../helpers/transform.helper'
import { Prisma, Project } from '@prisma/client'
import { Ctx } from '../helpers/context.helper'

type ProjectQuery = Static<typeof ProjectQuerySchema> & { offset: number; limit: number }
type CreateProjectBody = Static<typeof CreateProjectBodySchema>

/** @internal 不可变字段，更新时会被忽略 */
const IMMUTABLE = new Set(['id', 'githubId', 'createdAt', 'updatedAt', 'lastSyncAt'])

/**
 * @internal 允许排序的字段白名单。防止任意字段注入导致潜在的性能或信息泄露问题。
 */
const ORDERABLE = new Set<keyof Project>([
  'createdAt',
  'updatedAt',
  'stars',
  'forks',
  'lastCommit',
  'lastSyncAt',
  'name',
  'pinned',
])

/**
 * @internal 用户可编辑的标量字段。GitHub 来源字段保持只读，避免被手动篡改造成数据不一致。
 */
const EDITABLE_SCALAR_KEYS: Array<keyof CreateProjectBody> = [
  'notes',
  'favorite',
  'archived',
  'pinned',
  'score',
]

/**
 * @internal 幂等工具：数组去重并过滤掉空/无效值。
 */
const uniq = <T>(arr: T[]) =>
  Array.from(new Set(arr)).filter((v) => v !== undefined && v !== null && v !== '')

/**
 * 列表查询项目，支持分页、标签、语言、星标/分叉区间、模糊搜索、时间范围与多字段排序。
 *
 * - 默认只返回未归档 (archived=false) 项目，除非显式传入 archived=true。
 * - Tag / VideoLink 关系会一并加载并扁平化为 DTO。
 * - 排序字段受白名单限制，未指定或非法时按创建时间倒序。
 *
 * @param ctx 请求上下文（含 prisma / log / config）
 * @param query 查询参数（已附加 offset/limit）
 * @returns {Promise<{data: ReturnType<typeof toProjectDtos>; total: number}>} 分页数据与总数
 * @throws {AppError} 理论上仅内部错误；参数校验在路由层完成
 * @category Project
 */
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
    lastCommitStart,
    lastCommitEnd,
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
  if (language) conditions.language = { equals: language }
  if (languages?.length) conditions.language = { in: languages }

  // 名称模糊搜索
  if (name) conditions.name = { contains: name }

  // 关键词搜索
  if (keyword) {
    // 统一关键词：name / fullName / description
    conditions.OR = [
      { name: { contains: keyword } },
      { fullName: { contains: keyword } },
      { description: { contains: keyword } },
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
  if (lastCommitStart || lastCommitEnd) {
    conditions['lastCommit'] = {}
    if (lastCommitStart) conditions['lastCommit']['gte'] = new Date(lastCommitStart)
    if (lastCommitEnd) conditions['lastCommit']['lte'] = new Date(lastCommitEnd)
  }

  // 按标签筛选（多对多）
  if (tagNames?.length) {
    conditions.tags = {
      some: {
        tag: { name: { in: tagNames }, archived: false },
      },
    }
  }

  const order: Prisma.ProjectOrderByWithRelationInput[] = [{ pinned: 'desc' }]
  if (orderBy && ORDERABLE.has(orderBy)) {
    const direction = orderDirection === 'asc' ? 'asc' : 'desc'
    order.push({ [orderBy]: direction } as Prisma.ProjectOrderByWithRelationInput)
  } else {
    order.push({ createdAt: 'desc' })
  }

  ctx.log.debug({ conditions, order, offset, limit }, 'project.list query built')

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
  ctx.log.debug({ total, count: data.length }, 'project.list fetched')

  // 脱壳
  const flatData = toProjectDtos(data as unknown as ProjectWithRelations[])

  // 返回结果
  const result = { data: flatData, total }

  return result
}

/**
 * 获取所有未归档项目使用的语言列表（去重 + 排序）。
 *
 * @param ctx 请求上下文
 * @returns 排序后的语言名数组
 * @category Project
 */
export async function getProjectLanguagesService(ctx: Ctx) {
  const rows = await ctx.prisma.project.findMany({
    where: { archived: false, language: { not: null } },
    select: { language: true },
  })

  const languages = uniq(
    rows
      .map(({ language }) => language?.trim())
      .filter((value): value is string => Boolean(value && value.length))
  ).sort((a, b) => a.localeCompare(b))

  ctx.log.debug({ count: languages.length }, 'project.languages fetched')

  return languages
}

/**
 * 按 ID 获取单个项目（含标签与视频链接）。
 *
 * @param ctx 上下文
 * @param id 项目主键 ID
 * @returns 项目 DTO；不存在返回 null
 * @category Project
 */
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
  // 脱壳
  return toProjectDto(project as unknown as ProjectWithRelations)
}

/**
 * 创建新项目（幂等保护：依据 githubId 保证唯一）。
 *
 * 流程：
 * 1. 校验 githubId 不重复
 * 2. 创建 Project
 * 3. 处理 tags：存在则关联，不存在则批量创建后关联
 * 4. 批量创建 videoLinks
 * 5. 返回包含关系的扁平 DTO
 *
 * 所有操作在单个事务中执行，保证一致性。
 *
 * @param ctx 上下文
 * @param body 创建请求体
 * @returns 新项目 DTO
 * @throws {AppError} githubId 为空或已存在冲突
 * @category Project
 */
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
    ctx.log.debug({ result }, 'project created')

    return toProjectDto(result as unknown as ProjectWithRelations)
  })
}

/**
 * 更新项目（部分字段）。
 *
 * - IMMUTABLE 列表中的字段会被忽略。
 * - 仅对 EDITABLE_SCALAR_KEYS 中出现且值发生变化的字段执行更新。
 * - tags / videoLinks 使用“名称/URL 幂等”策略做差异同步（新增/移除）。
 * - 所有操作走同一事务，确保状态一致。
 *
 * @param ctx 上下文
 * @param id 项目 ID
 * @param rawBody 变更内容（部分字段）
 * @returns 最新项目 DTO
 * @throws {AppError} 项目不存在或已归档；更新后查不到项目（极少数并发表）
 * @category Project
 */
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

    // 2) 标量差异：只更新允许的字段且确实有变化
    const scalarUpdate: Record<string, unknown> = {}
    for (const key of EDITABLE_SCALAR_KEYS) {
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
        await tx.videoLink.createMany({
          data: toAdd.map((url) => ({ url, projectId: id })),
          skipDuplicates: true,
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
    ctx.log.debug({ result }, 'project updated')
    return toProjectDto(result as unknown as ProjectWithRelations)
  })
}

/**
 * 删除（归档并物理移除）项目的便捷包装，默认 reason=manual。
 * 实际逻辑由 `archiveAndDeleteProjectById` 复用。
 *
 * @param ctx 上下文
 * @param id 项目 ID
 * @category Project
 */
export async function deleteProjectService(ctx: Ctx, id: string) {
  await archiveAndDeleteProjectById(ctx, id, 'manual')
}

// 归档并删除 Project（统一给手动删除与同步软删调用）
/**
 * 归档并物理删除项目：
 *
 * 1. 读取完整实体 + 关系并生成快照 DTO
 * 2. 写入 `archivedProject` 归档表（允许同一 githubId 多次归档）
 * 3. 删除中间关联 & videoLinks & 主实体（保持主表干净，便于活跃数据查询）
 *
 * 设计说明：选择物理删除活跃表是为了控制表规模与查询性能；历史数据通过归档表追溯。
 *
 * @param ctx 上下文
 * @param id 项目 ID
 * @param reason 归档原因（manual=手动删除 / unstarred=同步检测不再 star）
 * @throws {AppError} 项目未找到
 * @category Project
 */
export async function archiveAndDeleteProjectById(
  ctx: Ctx,
  id: string,
  reason: 'manual' | 'unstarred'
) {
  await ctx.prisma.$transaction(async (tx) => {
    // 查完整实体+关系，转换为扁平快照
    const current = await tx.project.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true } },
        videoLinks: { select: { id: true, url: true } },
      },
    })
    if (!current) {
      throw new AppError(
        `Project not found: ${id}`,
        HTTP_STATUS.NOT_FOUND.statusCode,
        ERROR_TYPES.NOT_FOUND,
        { id }
      )
    }

    const snapshot = toProjectDto(current as unknown as ProjectWithRelations)

    // 归档表记录（允许同一 githubId 多次归档）
    await tx.archivedProject.create({
      data: {
        githubId: current.githubId,
        originalProjectId: current.id,
        reason: reason as 'manual' | 'unstarred',
        snapshot: snapshot as unknown as object,
        archivedAt: new Date(),
      },
    })

    // 删除关联与主体（选择物理删除，保持活跃表干净）
    await tx.projectTag.deleteMany({ where: { projectId: id } })
    await tx.videoLink.deleteMany({ where: { projectId: id } })
    await tx.project.delete({ where: { id } })
  })
}
