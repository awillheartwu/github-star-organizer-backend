// src/config/index.ts
import { loadConfig } from './loadConfig.config'

/**
 * 在 import 阶段加载配置：若解析失败，记录到控制台并抛出，让上层 main.ts fail fast。
 * 这里提供一个极小的兜底（仅 logger 级别与端口）防止引用时报 undefined，
 * 但真正的失败场景仍通过抛出 error 让进程退出。
 */
let loaded: ReturnType<typeof loadConfig> | undefined
try {
  loaded = loadConfig()
} catch (err) {
  // 标准化：结构化输出，避免多行堆栈污染启动判断；堆栈仍然附带
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      at: 'config.load',
      level: 'fatal',
      message: 'Failed to load configuration',
      errorType: 'ConfigError',
      error: (err as Error)?.message,
      stack: (err as Error)?.stack,
    })
  )
  throw new Error(`[ConfigError] ${(err as Error)?.message}`)
}
export const config = loaded
export type { AppConfig } from './loadConfig.config'
