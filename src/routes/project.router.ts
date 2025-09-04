import { FastifyInstance } from 'fastify'
import {
  ProjectQuerySchema,
  ProjectListResponseSchema,
  /* CreateProjectBodySchema, */
  BaseProjectResponseSchema,
  UpdateProjectBodySchema,
} from '../schemas/project.schema'
import { Type } from '@sinclair/typebox'
import { projectController } from '../controllers'

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/projects',
    {
      onRequest: [fastify.verifyAccess],
      schema: {
        description: '获取所有项目',
        tags: ['Project'],
        querystring: ProjectQuerySchema,
        response: { 200: ProjectListResponseSchema },
        summary: 'Get all projects',
        security: [{ bearerAuth: [] }],
      },
    },
    projectController.getProjects
  )
  fastify.get(
    '/projects/:id',
    {
      onRequest: [fastify.verifyAccess],
      schema: {
        description: '获取单个项目',
        tags: ['Project'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 200: BaseProjectResponseSchema },
        summary: 'Get a project by id',
        security: [{ bearerAuth: [] }],
      },
    },
    projectController.getProjectById
  )
  // 暂不开放创建（由同步产出），保留接口定义以便后续改造成“导入”模式
  // fastify.post(
  //   '/projects',
  //   {
  //     onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
  //     schema: {
  //       description: '创建项目',
  //       tags: ['Project'],
  //       body: CreateProjectBodySchema,
  //       response: { 201: BaseProjectResponseSchema },
  //       summary: 'Create a project',
  //       security: [{ bearerAuth: [] }],
  //     },
  //   },
  //   projectController.createProject
  // )
  fastify.put(
    '/projects/:id',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        description: '更新项目',
        tags: ['Project'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        body: UpdateProjectBodySchema,
        response: { 200: BaseProjectResponseSchema },
        summary: 'Update a project',
        security: [{ bearerAuth: [] }],
      },
    },
    projectController.updateProject
  )
  fastify.delete(
    '/projects/:id',
    {
      onRequest: [fastify.verifyAccess, fastify.roleGuard('ADMIN')],
      schema: {
        description: '删除项目',
        tags: ['Project'],
        params: Type.Object({ id: Type.String({ format: 'uuid' }) }),
        response: { 204: Type.Null() },
        summary: 'Delete a project',
        security: [{ bearerAuth: [] }],
      },
    },
    projectController.deleteProject
  )
}
