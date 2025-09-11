// BullMQ 队列名不允许包含 ':'，使用连字符代替
export const SYNC_STARS_QUEUE = 'sync-stars'
export const SYNC_STARS_JOB = 'sync-stars'

// 维护类任务（每日清理等）
export const MAINTENANCE_QUEUE = 'maintenance'
export const MAINTENANCE_JOB = 'maintenance'

// AI 摘要相关任务
export const AI_SUMMARY_QUEUE = 'ai-summary'
export const AI_SUMMARY_JOB = 'ai-summary'
export const AI_SWEEP_JOB = 'ai-sweep'
