import { FastifyInstance } from 'fastify'
import autoLoad from '@fastify/autoload'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default async function (app: FastifyInstance) {
  // 自动加载插件
  app.register(autoLoad, {
    dir: join(__dirname, 'plugins'),
  })

  // 自动加载路由
  app.register(autoLoad, {
    dir: join(__dirname, 'routes'),
  })
}
