import { FastifyReply, FastifyRequest } from 'fastify'
import { Static } from '@sinclair/typebox'
import { TagQuerySchema, CreateTagBodySchema } from '../schemas/tag.schema'
import { getPagination } from '../helpers/pagination.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import { getCtx } from '../helpers/context.helper'

import * as tagService from '../services/tag.service'

type TagQuery = Static<typeof TagQuerySchema>
type CreateTagBody = Static<typeof CreateTagBodySchema>

export async function getTags(req: FastifyRequest<{ Querystring: TagQuery }>, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { page, pageSize, offset, limit } = getPagination(req.query)
  const { data, total } = await tagService.getTagsService(ctx, { ...req.query, offset, limit })
  reply.send({ message: 'get all tags', data, total, page, pageSize })
}

export async function getTagById(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  // 获取单个 tag
  const ctx = getCtx(req)
  const { id } = req.params
  const tag = await tagService.getTagByIdService(ctx, id)
  if (!tag) {
    throw new AppError(
      `Tag not found: ${id}`,
      HTTP_STATUS.NOT_FOUND.statusCode,
      ERROR_TYPES.NOT_FOUND,
      { id }
    )
  }
  reply.send({ message: 'get tag by id', data: tag })
}

export async function createTag(req: FastifyRequest<{ Body: CreateTagBody }>, reply: FastifyReply) {
  // 新建 tag
  const ctx = getCtx(req)
  const data = await tagService.createTagService(ctx, req.body)
  reply.code(201).send({ message: 'create tag success', data })
}

export async function updateTag(
  req: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateTagBody> }>,
  reply: FastifyReply
) {
  // 修改 tag
  const ctx = getCtx(req)
  const data = await tagService.updateTagService(ctx, req.params.id, req.body)
  reply.send({ message: `update tag id: ${req.params.id}`, data })
}

export async function deleteTag(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  // 删除 tag
  const ctx = getCtx(req)
  await tagService.deleteTagService(ctx, req.params.id)
  reply.code(204).send()
}
