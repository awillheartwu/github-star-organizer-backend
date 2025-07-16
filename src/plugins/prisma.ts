import fastifyPrisma from '@joggr/fastify-prisma'
import { PrismaClient } from '@prisma/client'
import { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'

// Add this so you get types across the board
declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
  }
}

export default fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyPrisma, {
    client: new PrismaClient(),
  })
})
