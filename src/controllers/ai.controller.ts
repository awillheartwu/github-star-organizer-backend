// src/controllers/ai.controller.ts
import { FastifyReply, FastifyRequest } from 'fastify'
import * as aiService from '../services/ai.service'

export async function summarizeProject(req: FastifyRequest, reply: FastifyReply) {
  const { id } = req.params as { id: string }
  const body = req.body as unknown as {
    style?: 'short' | 'long' | 'both'
    lang?: 'zh' | 'en'
    model?: string
    temperature?: number
    createTags?: boolean
  }
  const data = await aiService.summarizeProject(req.server, id, body)
  return reply.send({ message: 'ok', data })
}
