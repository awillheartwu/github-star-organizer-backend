// src/plugins/config.ts
import fp from 'fastify-plugin'
import { config } from '../config'

export default fp(
  async (fastify) => {
    // 在 fastify 实例上挂 config 属性
    // 使用浅拷贝以便测试环境可覆盖少量字段（避免 Object.freeze 带来的只读限制）
    const mutableConfig = { ...config }
    fastify.decorate('config', mutableConfig)
  },
  { name: 'config' }
)
