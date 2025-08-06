import { FastifyReply, FastifyRequest } from 'fastify'
import { Static } from '@sinclair/typebox'
import { ProjectQuerySchema, CreateProjectBodySchema } from '../schemas/project.schema'
import { getPagination } from '../helpers/pagination.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'

import * as projectService from '../services/project.service'

type ProjectQuery = Static<typeof ProjectQuerySchema>
type CreateProjectBody = Static<typeof CreateProjectBodySchema>

export async function getProjects(
  req: FastifyRequest<{ Querystring: ProjectQuery }>,
  reply: FastifyReply
) {
  const { page, pageSize, offset, limit } = getPagination(req.query)
  const { data, total } = await projectService.getProjectsService({ offset, limit })
  reply.send({
    message: 'get all projects',
    data,
    page,
    pageSize,
    total,
  })
}

export async function getProjectById(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const { id } = req.params
  const project = await projectService.getProjectByIdService(id)
  if (!project) {
    throw new AppError(
      `Project not found: ${id}`,
      HTTP_STATUS.NOT_FOUND.statusCode,
      ERROR_TYPES.NOT_FOUND,
      { id }
    )
  }
  reply.send({ message: 'get project by id', data: project })
}

export async function createProject(
  req: FastifyRequest<{ Body: CreateProjectBody }>,
  reply: FastifyReply
) {
  const data = await projectService.createProjectService(req.body)
  reply.code(201).send({ message: 'create project success', data })
}

export async function updateProject(
  req: FastifyRequest<{ Params: { id: string }; Body: { name?: string; description?: string } }>,
  reply: FastifyReply
) {
  reply.send({ message: `update project id: ${req.params.id}`, body: req.body })
}

export async function deleteProject(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  reply.send({ message: `delete project id: ${req.params.id}` })
}
