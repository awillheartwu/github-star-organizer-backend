import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import fastifySensible from '@fastify/sensible'

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifySensible)
})
