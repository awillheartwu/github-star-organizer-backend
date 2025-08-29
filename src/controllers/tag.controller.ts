import { FastifyReply, FastifyRequest } from 'fastify'
import { Static } from '@sinclair/typebox'
import { TagQuerySchema, CreateTagBodySchema } from '../schemas/tag.schema'
import { getPagination } from '../helpers/pagination.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'

import * as tagService from '../services/tag.service'

type TagQuery = Static<typeof TagQuerySchema>
type CreateTagBody = Static<typeof CreateTagBodySchema>

export async function getTags(req: FastifyRequest<{ Querystring: TagQuery }>, reply: FastifyReply) {
  const { page, pageSize, offset, limit } = getPagination(req.query)
  const { data, total } = await tagService.getTagsService({ ...req.query, offset, limit })
  reply.send({ message: 'get all tags', data, total, page, pageSize })
}

export async function getTagById(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  // 获取单个 tag
  const { id } = req.params
  const tag = await tagService.getTagByIdService(id)
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
  const data = await tagService.createTagService(req.body)
  reply.code(201).send({ message: 'create tag success', data })
}

export async function updateTag(
  req: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateTagBody> }>,
  reply: FastifyReply
) {
  // 修改 tag
  const data = await tagService.updateTagService(req.params.id, req.body)
  reply.send({ message: `update tag id: ${req.params.id}`, data })
}

export async function deleteTag(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  // 删除 tag
  await tagService.deleteTagService(req.params.id)
  reply.code(204).send()
}
