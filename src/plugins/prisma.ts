// src/plugins/prisma.ts
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'

// 单例 Prisma 实例
const prisma = new PrismaClient()

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // 在 fastify 实例上挂 prisma 属性
  fastify.decorate('prisma', prisma)

  // 进程关闭时断开连接
  fastify.addHook('onClose', async (app) => {
    await app.prisma.$disconnect()
  })
}

export default prismaPlugin

export { prisma }
