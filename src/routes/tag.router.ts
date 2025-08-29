import { FastifyInstance } from 'fastify'
import {
  TagQuerySchema,
  CreateTagBodySchema,
  BaseTagResponseSchema,
  TagListResponseSchema,
  TagCreateResponseSchema,
} from '../schemas/tag.schema'
import { Type } from '@sinclair/typebox'
import * as tagController from '../controllers/tag.controller'

const TagUpdateBodySchema = TagCreateResponseSchema

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/tags',
    {
      schema: {
        description: '获取所有标签',
        tags: ['Tag'],
        querystring: TagQuerySchema,
        response: { 200: TagListResponseSchema },
        summary: 'Get all tags',
      },
    },
    tagController.getTags
  )
  fastify.get(
    '/tags/:id',
    {
      schema: {
        description: '获取单个标签',
        tags: ['Tag'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 200: BaseTagResponseSchema },
        summary: 'Get a tag by id',
      },
    },
    tagController.getTagById
  )
  fastify.post(
    '/tags',
    {
      schema: {
        description: '创建标签',
        tags: ['Tag'],
        body: CreateTagBodySchema,
        response: { 201: TagCreateResponseSchema },
        summary: 'Create a tag',
      },
    },
    tagController.createTag
  )
  fastify.put(
    '/tags/:id',
    {
      schema: {
        description: '更新标签',
        tags: ['Tag'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: Type.Partial(CreateTagBodySchema),
        response: { 200: TagUpdateBodySchema },
        summary: 'Update a tag',
      },
    },
    tagController.updateTag
  )
  fastify.delete(
    '/tags/:id',
    {
      schema: {
        description: '删除标签',
        tags: ['Tag'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 204: Type.Null() },
        summary: 'Delete a tag',
      },
    },
    tagController.deleteTag
  )
}
