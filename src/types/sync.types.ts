// 统一类型，方便后续换 Webhook/BullMQ/AI 总结也不改签名
export type SyncMode = 'full' | 'incremental'
export type SyncActor = 'cron' | 'manual' | 'webhook'

export interface SyncOptions {
  mode: SyncMode
  perPage?: number
  maxPages?: number // 0 = 不限
  softDeleteUnstarred?: boolean
  emitSummary?: boolean
}

export interface SyncStats {
  scanned: number
  created: number
  updated: number
  unchanged: number
  softDeleted: number
  pages: number
  rateLimitRemaining?: number
  errors?: number
  startedAt?: string
  finishedAt?: string
  durationMs?: number
}

export interface SyncJobData {
  options: SyncOptions
  actor?: SyncActor
  note?: string // 比如手动触发时的备注
}
