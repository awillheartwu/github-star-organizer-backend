import { Static } from '@sinclair/typebox'
import { TagQuerySchema, CreateTagBodySchema } from '../schemas/tag.schema'
import { AppError } from '../helpers/error.helper'
import { Prisma, Tag } from '@prisma/client'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import type { TagWithRelations } from '../helpers/transform.helper.js'
import { toTagDto } from '../helpers/transform.helper'
import { Ctx } from '../helpers/context.helper'

type TagQuery = Static<typeof TagQuerySchema> & { offset: number; limit: number }
type CreateTagBody = Static<typeof CreateTagBodySchema>

/** @internal 允许排序字段白名单 */
const ORDERABLE = new Set<keyof Tag>(['createdAt', 'updatedAt', 'name'])
const ORDER_BY_PROJECT_COUNT = 'projectCount'

function buildTagOrder(
  orderBy?: string,
  orderDirection?: 'asc' | 'desc'
): Prisma.TagOrderByWithRelationInput[] {
  const direction = orderDirection === 'asc' ? 'asc' : 'desc'
  if (orderBy === ORDER_BY_PROJECT_COUNT) {
    return [{ projects: { _count: direction } }, { createdAt: 'desc' }]
  }

  if (orderBy && ORDERABLE.has(orderBy as keyof Tag)) {
    return [{ [orderBy]: direction } as Prisma.TagOrderByWithRelationInput, { createdAt: 'desc' }]
  }

  return [{ projects: { _count: 'desc' } }, { createdAt: 'desc' }]
}

/**
 * 分页列出标签，支持按关键词、归档状态与排序。
 * @param ctx 上下文
 * @param query 查询参数（含 offset/limit）
 * @returns {Promise<{data: any[]; total: number}>} 标签数据及总数
 * @category Tag
 */
export async function getTagsService(ctx: Ctx, query: TagQuery) {
  const { offset, limit, archived, keyword, orderBy, orderDirection } = query

  // 构建查询条件
  const conditions: Record<string, unknown> = {}
  conditions.archived = archived ?? false
  if (keyword) {
    conditions.OR = [{ name: { contains: keyword } }, { description: { contains: keyword } }]
  }

  // 构建排序
  const order = buildTagOrder(orderBy, orderDirection)

  ctx.log.debug({ conditions, order, offset, limit }, 'tag.list query built')

  // 查询
  const [rows, total] = await Promise.all([
    ctx.prisma.tag.findMany({
      skip: offset,
      take: limit,
      where: conditions,
      orderBy: order,
      select: {
        id: true,
        name: true,
        description: true,
        archived: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        _count: { select: { projects: true } },
      },
    }),
    ctx.prisma.tag.count({ where: conditions }),
  ])
  const data = rows.map(({ _count, ...rest }) => ({
    ...rest,
    projectCount: _count?.projects ?? 0,
  }))
  ctx.log.debug({ data, total }, 'tag.list query result')
  return { data, total }
}

/**
 * 根据 ID 获取单个标签（含未归档项目关联）。
 * @param ctx 上下文
 * @param id 标签 ID
 * @returns 标签 DTO；不存在或已归档返回 null
 * @category Tag
 */
export async function getTagByIdService(
  ctx: Ctx,
  id: string,
  options?: { page?: number; pageSize?: number }
) {
  const page = options?.page && options.page > 0 ? options.page : 1
  const pageSize = options?.pageSize && options.pageSize > 0 ? options.pageSize : 20
  const skip = (page - 1) * pageSize

  const [tag, total] = await Promise.all([
    ctx.prisma.tag.findUnique({
      where: { id },
      include: {
        projects: {
          where: { project: { archived: false } },
          include: { project: { select: { id: true, name: true, fullName: true, url: true } } },
          orderBy: [{ project: { createdAt: 'desc' } }],
          skip,
          take: pageSize,
        },
      },
    }),
    ctx.prisma.projectTag.count({
      where: { tagId: id, project: { archived: false } },
    }),
  ])
  if (!tag || tag.archived) return null
  ctx.log.debug({ tag }, 'tag found')
  const dto = toTagDto(tag as TagWithRelations)
  return {
    ...dto,
    projectsTotal: total,
    projectsPage: page,
    projectsPageSize: pageSize,
  }
}

/**
 * 创建新标签（按 name 去重，同名未归档存在则报错）。
 * @throws {AppError} 名称冲突 (400)
 * @category Tag
 */
export async function createTagService(ctx: Ctx, tagData: CreateTagBody) {
  // 检查同名 tag
  const existing = await ctx.prisma.tag.findFirst({
    where: { name: tagData.name, archived: false },
  })
  if (existing) {
    throw new AppError(
      `Tag name already exists: ${tagData.name}`,
      HTTP_STATUS.BAD_REQUEST.statusCode,
      ERROR_TYPES.VALIDATION,
      { name: tagData.name }
    )
  }
  const tag = await ctx.prisma.tag.create({ data: tagData })
  ctx.log.debug({ tag }, 'tag created')
  return tag
}

/**
 * 更新标签（支持改名和描述）。
 * - 若名称与其他标签冲突：409/400
 * - 如果目标名称是归档标签，视为冲突（禁止复用归档名）
 * @category Tag
 */
export async function updateTagService(ctx: Ctx, id: string, tagData: Partial<CreateTagBody>) {
  // 检查同名 tag
  if (tagData.name) {
    const existing = await ctx.prisma.tag.findFirst({
      where: { name: tagData.name },
    })
    if (existing && existing.id !== id) {
      throw new AppError(
        `Tag name already exists: ${tagData.name}`,
        HTTP_STATUS.BAD_REQUEST.statusCode,
        ERROR_TYPES.VALIDATION,
        { name: tagData.name }
      )
    }
    if (existing && existing.archived) {
      throw new AppError(
        `Tag name already exists (archived): ${tagData.name}`,
        HTTP_STATUS.CONFLICT.statusCode,
        ERROR_TYPES.CONFLICT,
        { name: tagData.name }
      )
    }
  }
  const tag = await ctx.prisma.tag.update({ where: { id }, data: tagData })
  ctx.log.debug({ tag }, 'tag updated')
  return tag
}

/**
 * 归档标签并解除与项目的关联（逻辑删除：archived=true）。
 * @throws {AppError} 不存在 / 已归档（404 / 409）
 * @category Tag
 */
export async function deleteTagService(ctx: Ctx, id: string) {
  await ctx.prisma.$transaction(async (tx) => {
    // 1. 确认存在
    const existing = await tx.tag.findUnique({ where: { id } })
    if (!existing) {
      throw new AppError(
        `Tag not found or archived: ${id}`,
        HTTP_STATUS.NOT_FOUND.statusCode,
        ERROR_TYPES.NOT_FOUND,
        { id }
      )
    }
    if (existing.archived) {
      throw new AppError(
        `Tag already archived: ${id}`,
        HTTP_STATUS.CONFLICT.statusCode,
        ERROR_TYPES.CONFLICT,
        { id }
      )
    }

    // 2. 删除关联数据
    await tx.projectTag.deleteMany({ where: { tagId: id } })

    // 3. 删除 tag
    await tx.tag.update({ where: { id }, data: { archived: true, updatedAt: new Date() } })
    ctx.log.debug({ id }, 'tag archived')
  })
}
