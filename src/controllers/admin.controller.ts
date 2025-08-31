// src/controllers/admin.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify'
import { getCtx } from '../helpers/context.helper'
import * as userService from '../services/user.service'

export async function setRole(req: FastifyRequest, reply: FastifyReply) {
  const ctx = getCtx(req)
  const { userId, role } = req.body as { userId: string; role: 'USER' | 'ADMIN' }
  await userService.setUserRole(ctx, userId, role)
  return reply.send({ message: 'role updated' })
}
