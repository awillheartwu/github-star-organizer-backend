// src/plugins/config.ts
import fp from 'fastify-plugin'
import { config } from '../config'

export default fp(
  async (fastify) => {
    // 在 fastify 实例上挂 config 属性
    fastify.decorate('config', config)
  },
  { name: 'config' }
)
