# Runtime Configuration
本文档根据 TypeBox Schema 自动生成，包含环境变量与应用配置的键、类型与默认值。

## Environment Variables (EnvSchema)
| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| NODE_ENV | unknown | yes | development |  |
| PORT | number | yes | 3000 |  |
| FASTIFY_CLOSE_GRACE_DELAY | string | yes | 500 |  |
| LOG_LEVEL | unknown | yes | info |  |
| DATABASE_URL | string | yes |  | PostgreSQL connection string |
| AI_API_KEY | string | no |  | AI 提供商 API Key（DeepSeek 等） |
| AI_MODEL | string | no | deepseek-chat | AI 模型名称，如 deepseek-chat |
| AI_TEMPERATURE | number | no | 0.3 | AI 采样温度（0~1），越大越发散 |
| AI_SUMMARY_CONCURRENCY | number | no | 1 | AI 摘要任务并发（worker） |
| AI_SUMMARY_CRON | string | no |  | AI 摘要批量扫描定时表达式（可空） |
| AI_SUMMARY_STALE_DAYS | number | no | 365 | AI 摘要过期天数（TTL） |
| AI_README_MAX_CHARS | number | no | 4000 | 读取 README 片段最大字符数 |
| AI_RPM_LIMIT | number | no |  | AI 提供商每分钟请求上限（可空表示不限制） |
| CORS_ORIGIN | string | no | * |  |
| CORS_CREDENTIALS | boolean | no | false |  |
| TRUST_PROXY | boolean | no | false |  |
| BODY_LIMIT | number | no | 1048576 |  |
| HELMET_CSP | boolean | no | true |  |
| JWT_ACCESS_SECRET | string | yes |  | Access Token 签名密钥（保密） |
| JWT_REFRESH_SECRET | string | yes |  | Refresh Token 签名密钥（保密） |
| JWT_ACCESS_EXPIRES | string | yes | 15m | AT 过期时间，如 15m/1h |
| JWT_REFRESH_EXPIRES | string | yes | 30d | RT 过期时间，如 30d |
| AUTH_COOKIE_NAME | string | yes | rt | Refresh Token Cookie 名称 |
| AUTH_COOKIE_DOMAIN | string | no |  | Refresh Token Cookie 域名 |
| AUTH_COOKIE_SECURE | boolean | yes | false | Refresh Token Cookie 是否安全 |
| AUTH_COOKIE_SAME_SITE | unknown | yes | lax |  |
| AUTH_ALLOW_REGISTRATION | boolean | yes | true | 是否允许注册新用户 |
| RATE_LIMIT_WINDOW | number | no | 60000 | 限流窗口时间（毫秒） |
| RATE_LIMIT_MAX | number | no | 20 | 限流最大请求数 |
| REDIS_HOST | string | yes |  | Redis 主机地址 |
| REDIS_PORT | number | yes | 6379 | Redis 端口 |
| REDIS_PASSWORD | string | yes |  | Redis 密码 |
| BULL_PREFIX | string | yes | gsor | BullMQ key 前缀 |
| BULL_ROLE | unknown | yes | both | BullMQ 角色：both/worker/producer |
| GITHUB_TOKEN | string | no |  | GitHub Personal Access Token |
| GITHUB_USERNAME | string | yes |  | 要同步其 stars 的 GitHub 用户名 |
| SYNC_STARS_CRON | string | no | 0 5 * * * | stars 同步 cron 表达式（每天 05:00） |
| SYNC_CONCURRENCY | number | no | 2 | BullMQ worker 并发 |
| SYNC_JOB_ATTEMPTS | number | no | 3 | 重试次数 |
| SYNC_JOB_BACKOFF_MS | number | no | 30000 | 失败后退避时间（毫秒） |
| SYNC_PER_PAGE | number | no | 50 | 每页抓取大小 |
| SYNC_MAX_PAGES | number | no | 0 | 最大页数，0 表示无限 |
| SYNC_SOFT_DELETE_UNSTARRED | boolean | no | false | 全量末页未出现的项目是否归档删除 |
| SYNC_REQUEST_TIMEOUT | number | no | 15000 | GitHub 请求超时（毫秒） |
| NOTIFY_EMAIL_ENABLED | boolean | no | false | 启用邮件通知（同步/维护） |
| SMTP_HOST | string | no |  | SMTP 主机 |
| SMTP_PORT | number | no | 465 | SMTP 端口 |
| SMTP_SECURE | boolean | no | true | SMTP TLS |
| SMTP_USER | string | no |  | SMTP 用户名 |
| SMTP_PASS | string | no |  | SMTP 授权码/密码 |
| MAIL_FROM | string | no |  | 邮件 From 显示 |
| MAIL_TO | string | no |  | 通知收件人，逗号分隔 |
| RT_EXPIRED_CLEAN_AFTER_DAYS | number | no | 0 | 过期 RT 保留天数（0 立即清理） |
| RT_REVOKED_RETENTION_DAYS | number | no | 7 | 吊销 RT 审计保留天数 |
| RT_CLEAN_BATCH | number | no | 1000 | 清理批次大小 |
| RT_CLEAN_DRY_RUN | boolean | no | true | 仅预览 |
| BULL_DRY_RUN | boolean | no | true | Bull 清理仅预览 |
| BULL_CLEAN_COMPLETED_AFTER_DAYS | number | no | 3 | 清理已完成任务（天） |
| BULL_CLEAN_FAILED_AFTER_DAYS | number | no | 30 | 清理失败任务（天） |
| BULL_TRIM_EVENTS | number | no | 1000 | 保留事件条数 |
| BULL_UI_ENABLED | boolean | no | false | 开启 Bull Board 可视化界面 |
| BULL_UI_PATH | string | no | /admin/queues/ui | Bull Board 基础路径 |
| BULL_UI_READONLY | boolean | no | true | 仅查看（禁用删除/重试等操作） |
| MAINT_ENABLED | boolean | no | true | 开启日常维护 |
| MAINT_CRON | string | no | 0 3 * * * | 维护任务 cron（默认 03:00） |

## App Config Shape (AppConfigSchema)
| Key | Type | Required | Default | Description |
|-----|------|----------|---------|-------------|
| env | unknown | yes |  |  |
| port | number | yes |  |  |
| fastifyCloseGraceDelay | string | yes | 500 |  |
| logLevel | unknown | yes |  |  |
| databaseUrl | string | yes |  |  |
| githubToken | string | no |  |  |
| aiApiKey | string | no |  |  |
| aiModel | string | no |  |  |
| aiTemperature | number | no |  |  |
| aiSummaryConcurrency | number | no |  |  |
| aiSummaryCron | string | no |  |  |
| aiSummaryStaleDays | number | no |  |  |
| aiReadmeMaxChars | number | no |  |  |
| aiRpmLimit | number | no |  |  |
| corsOrigin | string | yes |  |  |
| corsCredentials | boolean | yes |  |  |
| trustProxy | boolean | yes |  |  |
| bodyLimit | number | yes |  |  |
| helmetCsp | boolean | yes |  |  |
| jwtAccessSecret | string | yes |  |  |
| jwtRefreshSecret | string | yes |  |  |
| jwtAccessExpires | string | yes |  |  |
| jwtRefreshExpires | string | yes |  |  |
| authCookieName | string | yes |  |  |
| authCookieDomain | string | no |  |  |
| authCookieSecure | boolean | yes |  |  |
| authCookieSameSite | unknown | yes |  |  |
| authAllowRegistration | boolean | yes |  |  |
| rateLimitWindow | number | no |  |  |
| rateLimitMax | number | no |  |  |
| redisHost | string | yes |  |  |
| redisPort | number | yes | 6379 |  |
| redisPassword | string | yes |  |  |
| bullPrefix | string | yes |  |  |
| bullRole | unknown | yes |  |  |
| githubUsername | string | yes |  |  |
| syncStarsCron | string | no |  |  |
| syncConcurrency | number | no |  |  |
| syncJobAttempts | number | no |  |  |
| syncJobBackoffMs | number | no |  |  |
| syncPerPage | number | no |  |  |
| syncMaxPages | number | no |  |  |
| syncSoftDeleteUnstarred | boolean | no |  |  |
| syncRequestTimeout | number | no |  |  |
| notifyEmailEnabled | boolean | no |  |  |
| smtpHost | string | no |  |  |
| smtpPort | number | no |  |  |
| smtpSecure | boolean | no |  |  |
| smtpUser | string | no |  |  |
| smtpPass | string | no |  |  |
| mailFrom | string | no |  |  |
| mailTo | string | no |  |  |
| rtExpiredCleanAfterDays | number | yes |  |  |
| rtRevokedRetentionDays | number | yes |  |  |
| rtCleanBatch | number | yes |  |  |
| rtCleanDryRun | boolean | yes |  |  |
| bullCleanDryRun | boolean | yes |  |  |
| bullCleanCompletedAfterDays | number | yes |  |  |
| bullCleanFailedAfterDays | number | yes |  |  |
| bullTrimEvents | number | yes |  |  |
| bullUiEnabled | boolean | no |  |  |
| bullUiPath | string | no |  |  |
| bullUiReadOnly | boolean | no |  |  |
| maintEnabled | boolean | yes |  |  |
| maintCron | string | yes |  |  |
