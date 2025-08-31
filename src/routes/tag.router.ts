import { FastifyInstance } from 'fastify'
import {
  TagQuerySchema,
  CreateTagBodySchema,
  BaseTagResponseSchema,
  TagListResponseSchema,
  TagCreateResponseSchema,
} from '../schemas/tag.schema'
import { Type } from '@sinclair/typebox'
import { tagController } from '../controllers'

const TagUpdateBodySchema = TagCreateResponseSchema

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/tags',
    {
      onRequest: [fastify.verifyAccess],
      schema: {
        description: '获取所有标签',
        tags: ['Tag'],
        querystring: TagQuerySchema,
        response: { 200: TagListResponseSchema },
        summary: 'Get all tags',
        security: [{ bearerAuth: [] }],
      },
    },
    tagController.getTags
  )
  fastify.get(
    '/tags/:id',
    {
      onRequest: [fastify.verifyAccess],
      schema: {
        description: '获取单个标签',
        tags: ['Tag'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 200: BaseTagResponseSchema },
        summary: 'Get a tag by id',
        security: [{ bearerAuth: [] }],
      },
    },
    tagController.getTagById
  )
  fastify.post(
    '/tags',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        description: '创建标签',
        tags: ['Tag'],
        body: CreateTagBodySchema,
        response: { 201: TagCreateResponseSchema },
        summary: 'Create a tag',
        security: [{ bearerAuth: [] }],
      },
    },
    tagController.createTag
  )
  fastify.put(
    '/tags/:id',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        description: '更新标签',
        tags: ['Tag'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Partial(CreateTagBodySchema),
        response: { 200: TagUpdateBodySchema },
        summary: 'Update a tag',
        security: [{ bearerAuth: [] }],
      },
    },
    tagController.updateTag
  )
  fastify.delete(
    '/tags/:id',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        description: '删除标签',
        tags: ['Tag'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 204: Type.Null() },
        summary: 'Delete a tag',
        security: [{ bearerAuth: [] }],
      },
    },
    tagController.deleteTag
  )
}
