// src/config/index.ts
import { loadConfig } from './loadConfig.config'
export const config = loadConfig()
export type { AppConfig } from './loadConfig.config'
