import { FastifyInstance } from 'fastify'
import * as tagController from '../controllers/tag.controller'

export default async function (fastify: FastifyInstance) {
  fastify.get('/tags', tagController.getTags)
  fastify.post('/tags', tagController.createTag)
}
