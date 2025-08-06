import { FastifyInstance } from 'fastify'
import {
  ProjectQuerySchema,
  ProjectListResponseSchema,
  CreateProjectBodySchema,
  BaseProjectResponseSchema,
} from '../schemas/project.schema'
import { Type } from '@sinclair/typebox'
import * as projectController from '../controllers/project.controller'

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/projects',
    {
      schema: {
        description: '获取所有项目',
        tags: ['Project'],
        querystring: ProjectQuerySchema,
        response: { 200: ProjectListResponseSchema },
        summary: 'Get all projects',
      },
    },
    projectController.getProjects
  )
  fastify.get(
    '/projects/:id',
    {
      schema: {
        description: '获取单个项目',
        tags: ['Project'],
        params: Type.Object({ id: Type.String() }),
        response: { 200: BaseProjectResponseSchema },
        summary: 'Get project by id',
      },
    },
    projectController.getProjectById
  )
  fastify.post(
    '/projects',
    {
      schema: {
        description: '创建项目',
        tags: ['Project'],
        body: CreateProjectBodySchema,
        response: { 201: BaseProjectResponseSchema },
        summary: 'Create project',
      },
    },
    projectController.createProject
  )
  fastify.put('/projects/:id', projectController.updateProject)
  fastify.delete('/projects/:id', projectController.deleteProject)
}
