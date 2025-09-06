import type { FastifyInstance } from 'fastify'
import type { SyncStats } from '../types/sync.types'
import type { AppConfig } from '../config'

/** @internal 从未知错误对象提取可读 message */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err && 'message' in err) {
    const m = (err as { message?: unknown }).message
    return typeof m === 'string' ? m : JSON.stringify(err)
  }
  return String(err)
}

/**
 * 发送同步成功通知邮件。
 * @param app Fastify 实例（含 mailer & config）
 * @param jobId 任务 ID
 * @param stats 同步统计
 * @category Notification
 */
export async function sendSyncCompleted(
  app: FastifyInstance,
  jobId: string | number,
  stats: SyncStats
) {
  if (!app.config.notifyEmailEnabled) return
  const to = (app.config.mailTo || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!to.length) return
  const subject = `[GitHub Stars] Sync completed — pages:${stats.pages} scanned:${stats.scanned}`
  const text =
    `Job ${jobId} completed\n\n` +
    `pages=${stats.pages}\nscanned=${stats.scanned}\ncreated=${stats.created}\nupdated=${stats.updated}\nunchanged=${stats.unchanged}\nsoftDeleted=${stats.softDeleted}\narchivedCount=${stats.softDeleted}  # equals softDeleted\nrateLimitRemaining=${stats.rateLimitRemaining ?? '-'}\n` +
    `startedAt=${stats.startedAt ?? ''}\nfinishedAt=${stats.finishedAt ?? ''}\ndurationMs=${stats.durationMs ?? ''}`

  const html = renderCompletedHtml(jobId, stats)
  await app.mailer.send({ to, subject, text, html })
}

/**
 * 发送同步失败通知邮件。
 * @param err 错误对象
 * @category Notification
 */
export async function sendSyncFailed(app: FastifyInstance, jobId: string | number, err: unknown) {
  if (!app.config.notifyEmailEnabled) return
  const to = (app.config.mailTo || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!to.length) return
  const subject = `[GitHub Stars] Sync failed — job:${jobId}`
  const text = `Job ${jobId} failed\n\n` + errorMessage(err)
  const html = renderFailedHtml(jobId, errorMessage(err))
  await app.mailer.send({ to, subject, text, html })
}

// —— Maintenance (RT/BullMQ cleanup) —— //
type RtCleanSummary = {
  dryRun: boolean
  expiredPreview: number
  revokedPreview: number
  expiredDeleted: number
  revokedDeleted: number
}
type BullCleanSummary = {
  dryRun: boolean
  queue: string
  cleanedCompleted: number
  cleanedFailed: number
  trimmedEventsTo: number
  removedRepeatables: number
}

/**
 * 发送维护清理成功报告邮件（RefreshToken + BullMQ）。
 * @category Notification
 */
export async function sendMaintenanceCompleted(
  app: FastifyInstance,
  jobId: string | number,
  rt: RtCleanSummary,
  bull: BullCleanSummary,
  cfg: AppConfig
) {
  if (!app.config.notifyEmailEnabled) return
  const to = (app.config.mailTo || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!to.length) return

  const subject = `[Maintenance] Daily cleanup completed — rt:${rt.expiredDeleted + rt.revokedDeleted} bull:${bull.cleanedCompleted + bull.cleanedFailed}`
  const text =
    `Job ${jobId} completed\n\n` +
    `RT: dryRun=${rt.dryRun} expiredPreview=${rt.expiredPreview} revokedPreview=${rt.revokedPreview} expiredDeleted=${rt.expiredDeleted} revokedDeleted=${rt.revokedDeleted}\n` +
    `Bull: dryRun=${bull.dryRun} queue=${bull.queue} cleanedCompleted=${bull.cleanedCompleted} cleanedFailed=${bull.cleanedFailed} trimmedEventsTo=${bull.trimmedEventsTo} removedRepeatables=${bull.removedRepeatables}\n` +
    `Cron=${cfg.maintCron}`

  const html = renderMaintenanceHtml(jobId, rt, bull, cfg)
  await app.mailer.send({ to, subject, text, html })
}

/**
 * 发送维护任务失败通知。
 * @category Notification
 */
export async function sendMaintenanceFailed(
  app: FastifyInstance,
  jobId: string | number,
  err: unknown
) {
  if (!app.config.notifyEmailEnabled) return
  const to = (app.config.mailTo || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  if (!to.length) return
  const subject = `[Maintenance] Daily cleanup failed — job:${jobId}`
  const text = `Job ${jobId} failed\n\n` + errorMessage(err)
  const html = renderFailedHtml(jobId, errorMessage(err))
  await app.mailer.send({ to, subject, text, html })
}

// ---- HTML templates ----
/** @internal 邮件 HTML 外壳模板 */
function renderShell(body: string, title = 'GitHub Stars Notification') {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body{background:#f5f7fa;margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937}
    .card{max-width:640px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 14px rgba(0,0,0,.08);overflow:hidden}
    .header{padding:16px 20px;border-bottom:1px solid #eef2f7;font-weight:600}
    .content{padding:20px}
    .kv{width:100%;border-collapse:collapse;font-size:14px}
    .kv th,.kv td{padding:10px 8px;border-bottom:1px solid #f1f5f9;text-align:left}
    .kv th{width:40%;color:#64748b;font-weight:500}
    .ok{color:#16a34a}
    .fail{color:#dc2626}
    .muted{margin-top:12px;color:#94a3b8;font-size:12px}
    code{background:#f8fafc;border:1px solid #e5e7eb;border-radius:6px;padding:2px 6px}
  </style>
  </head>
<body>
  <div class="card">
    ${body}
  </div>
</body>
</html>`
}

/** @internal 构建同步成功 HTML */
function renderCompletedHtml(jobId: string | number, s: SyncStats) {
  const body = `
  <div class="header">Sync Completed <span class="ok">• success</span></div>
  <div class="content">
    <p>Job <code>${escapeHtml(String(jobId))}</code> completed.</p>
    <table class="kv">
      ${tr('pages', s.pages)}
      ${tr('scanned', s.scanned)}
      ${tr('created', s.created)}
      ${tr('updated', s.updated)}
      ${tr('unchanged', s.unchanged)}
      ${tr('softDeleted', s.softDeleted)}
      ${tr('archivedCount', s.softDeleted)}
      ${tr('rateLimitRemaining', s.rateLimitRemaining ?? '-')} 
      ${tr('startedAt', s.startedAt ?? '')}
      ${tr('finishedAt', s.finishedAt ?? '')}
      ${tr('durationMs', s.durationMs ?? '')}
    </table>
    <p class="muted">GitHub Star Organizer · This is an automated message.</p>
  </div>`
  return renderShell(body, 'Sync completed')
}

/** @internal 构建维护成功 HTML */
function renderMaintenanceHtml(
  jobId: string | number,
  rt: RtCleanSummary,
  bull: BullCleanSummary,
  cfg: AppConfig
) {
  const body = `
  <div class="header">Maintenance Completed <span class="ok">• success</span></div>
  <div class="content">
    <p>Job <code>${escapeHtml(String(jobId))}</code> completed. Cron <code>${escapeHtml(
      cfg.maintCron
    )}</code></p>
    <h3>RefreshToken</h3>
    <table class="kv">
      ${tr('dryRun', rt.dryRun)}
      ${tr('expiredPreview', rt.expiredPreview)}
      ${tr('revokedPreview', rt.revokedPreview)}
      ${tr('expiredDeleted', rt.expiredDeleted)}
      ${tr('revokedDeleted', rt.revokedDeleted)}
    </table>
    <h3 style="margin-top:16px">BullMQ</h3>
    <table class="kv">
      ${tr('dryRun', bull.dryRun)}
      ${tr('queue', bull.queue)}
      ${tr('cleanedCompleted', bull.cleanedCompleted)}
      ${tr('cleanedFailed', bull.cleanedFailed)}
      ${tr('trimmedEventsTo', bull.trimmedEventsTo)}
      ${tr('removedRepeatables', bull.removedRepeatables)}
    </table>
    <p class="muted">GitHub Star Organizer · Automated maintenance report.</p>
  </div>`
  return renderShell(body, 'Daily Maintenance')
}

/** @internal 构建失败通知 HTML */
function renderFailedHtml(jobId: string | number, message: string) {
  const body = `
  <div class="header">Sync Failed <span class="fail">• error</span></div>
  <div class="content">
    <p>Job <code>${escapeHtml(String(jobId))}</code> failed.</p>
    <table class="kv">
      ${tr('error', message)}
    </table>
    <p class="muted">Please check server logs for details.</p>
  </div>`
  return renderShell(body, 'Sync failed')
}

/** @internal HTML 表格行辅助 */
function tr(key: string, val: unknown) {
  return `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(val))}</td></tr>`
}

/** @internal 简易 HTML 转义 */
function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
