import 'fastify'
import { PrismaClient } from '@prisma/client'
import { config } from '../config'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    config: typeof config
  }
}
