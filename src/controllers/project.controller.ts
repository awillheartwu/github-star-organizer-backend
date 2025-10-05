import { FastifyReply, FastifyRequest } from 'fastify'
import { Static } from '@sinclair/typebox'
import { ProjectQuerySchema, CreateProjectBodySchema } from '../schemas/project.schema'
import { getPagination } from '../helpers/pagination.helper'
import { AppError } from '../helpers/error.helper'
import { HTTP_STATUS, ERROR_TYPES } from '../constants/errorCodes'
import { getCtx } from '../helpers/context.helper'

import * as projectService from '../services/project.service'

type ProjectQuery = Static<typeof ProjectQuerySchema>
type CreateProjectBody = Static<typeof CreateProjectBodySchema>

export async function getProjects(
  req: FastifyRequest<{ Querystring: ProjectQuery }>,
  reply: FastifyReply
) {
  // 获取所有项目
  const ctx = getCtx(req)
  // 额外防御性校验：使用 fastify-sensible 的 assert 做区间检查
  const { starsMin, starsMax, forksMin, forksMax } = req.query
  if (starsMin !== undefined && starsMax !== undefined) {
    req.server.assert(
      Number(starsMax) >= Number(starsMin),
      400,
      'starsMax must be greater than or equal to starsMin'
    )
  }
  if (forksMin !== undefined && forksMax !== undefined) {
    req.server.assert(
      Number(forksMax) >= Number(forksMin),
      400,
      'forksMax must be greater than or equal to forksMin'
    )
  }
  const { page, pageSize, offset, limit } = getPagination(req.query)
  const { data, total } = await projectService.getProjectsService(ctx, {
    ...req.query,
    offset,
    limit,
  })
  reply.send({
    message: 'get all projects',
    data,
    page,
    pageSize,
    total,
  })
}

export async function getProjectLanguages(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const languages = await projectService.getProjectLanguagesService(ctx)
  reply.send({ message: 'get project languages', data: languages })
}

export async function getProjectById(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const ctx = getCtx(req)
  const { id } = req.params
  const project = await projectService.getProjectByIdService(ctx, id)
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
  const ctx = getCtx(req)
  const data = await projectService.createProjectService(ctx, req.body)
  reply.code(201).send({ message: 'create project success', data })
}

export async function updateProject(
  req: FastifyRequest<{ Params: { id: string }; Body: Partial<CreateProjectBody> }>,
  reply: FastifyReply
) {
  const ctx = getCtx(req)
  const data = await projectService.updateProjectService(ctx, req.params.id, req.body)
  reply.send({ message: `update project id: ${req.params.id}`, data })
}

export async function deleteProject(
  req: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const ctx = getCtx(req)
  await projectService.deleteProjectService(ctx, req.params.id)
  reply.code(204).send()
}
