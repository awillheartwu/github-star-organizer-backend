<h1 align="center">GitHub Star Organizer · Backend</h1>
<p align="center">
Fastify + TypeBox + Prisma + BullMQ + JWT 的模块化后端。支持 GitHub Stars 同步、AI 摘要、定时维护、队列可视化与结构化错误模型。
</p>

## 目录
- [目录](#目录)
- [特性概览](#特性概览)
- [架构与技术栈](#架构与技术栈)
- [快速开始](#快速开始)
- [配置与环境变量](#配置与环境变量)
- [认证与安全](#认证与安全)
- [同步与队列设计](#同步与队列设计)
- [AI 摘要与批处理](#ai-摘要与批处理)
- [维护任务 / 清理策略](#维护任务--清理策略)
- [通知邮件](#通知邮件)
- [错误模型](#错误模型)
- [可观测性与日志](#可观测性与日志)
- [开发与脚本](#开发与脚本)
- [测试策略](#测试策略)
- [Roadmap / 可扩展点](#roadmap--可扩展点)
- [贡献](#贡献)
- [许可证](#许可证)
- [参考](#参考)

---
## 特性概览
| 模块 | 功能 | 说明 |
|------|------|------|
| GitHub Stars 同步 | 增量/定时/ETag 缓存 | BullMQ 定时任务 + 支持软删除归档 |
| AI 摘要 | README/项目标签生成 | 控制速率 (RPM)、支持批量扫描 & 汇总邮件 |
| 维护任务 | Refresh Token & Bull 队列清理 | Cron repeatable job + 可 Dry-Run |
| 鉴权 | JWT 双令牌 + 版本失效 | Access/Refresh + tokenVersion 强制注销 |
| RBAC | `roleGuard('ADMIN')` | 精细到路由级的角色限制 |
| 队列可视化 | Bull Board | 支持只读模式防止生产误操作 |
| 通知 | 同步/失败/维护/AI | 邮件模板 HTML + 可选启用 |
| 配置系统 | TypeBox 强校验 | 加载失败 Fail Fast，结构化日志 |
| 错误模型 | `AppError` + 分类 | 统一 JSON 输出，便于前端与监控 |
| 可观测性 | 结构化日志 + meta | GitHub RequestError 附加限流元数据 |

---
## 架构与技术栈
* **Fastify 5**：高性能 HTTP 核心
* **TypeBox**：请求/响应 Schema & 运行时校验
* **Prisma**：数据库 ORM（`/prisma/schema.prisma`）
* **BullMQ**：任务队列（同步 / AI / 维护）
* **Redis (ioredis)**：队列 / 速率限制 / 临时状态
* **JWT 双令牌**：`@fastify/jwt`（access + refresh）
* **Octokit**：GitHub API 客户端
* **Nodemailer**：邮件发送
* **Swagger(OpenAPI)**：API 文档 `GET /docs`
* **Bull Board**：`/admin/queues/ui`（可只读）

目录速览：
```
src/
  config/       环境与应用配置 (TypeBox)
  plugins/      Fastify 插件 (auth, bullmq, bullboard, prisma, redis ...)
  routes/       路由 (auth, project, admin, ai, tag, health)
  services/     业务逻辑与外部集成
  helpers/      错误处理、上下文、转换
  constants/    错误码、队列名等
  schemas/      TypeBox Schema 定义
  types/        共用类型
```

---
## 快速开始
```bash
# 安装依赖
pnpm install

# 生成 Prisma Client & 本地数据库迁移
pnpm migrate   # 或: pnpm prisma migrate dev

# 启动开发（加载 .env.development）
pnpm dev

# 访问 API 文档
open http://localhost:3000/docs
```
生产构建：
```bash
pnpm build
pnpm start
```

可选初始化管理员：
```bash
pnpm seed:admin
```

---
## 配置与环境变量
完整表见 `docs/config.md`（脚本：`pnpm docs:config` 重新生成）。加载流程：
1. 读取 `.env` → `.env.$NODE_ENV` 覆盖
2. 使用 TypeBox Convert + Decode 强类型转换
3. 映射为内部 `AppConfig`（冻结对象）
4. 任一校验失败 → Fatal 日志 + 进程退出

关键变量（节选）：
| 变量 | 说明 |
|------|------|
| `GITHUB_USERNAME` | 要同步的 GitHub 用户名 |
| `SYNC_STARS_CRON` | Stars 同步 cron（增量） |
| `AI_SUMMARY_CRON` | AI 扫描批处理 cron |
| `AI_SUMMARY_LIMIT` | AI 批量扫描默认数量（1-800） |
| `BULL_ROLE` | `both` / `worker` / `producer` |
| `BULL_UI_ENABLED` | 启用队列 UI |
| `BULL_UI_READONLY` | UI 只读防误操作 |
| `AUTH_ALLOW_REGISTRATION` | 是否允许注册 |
| `AI_RPM_LIMIT` | AI 每分钟请求上限（Redis 限流） |
| `NOTIFY_EMAIL_ENABLED` | 启用通知邮件 |

---
## 认证与安全
* Access / Refresh 双令牌；Refresh 通过 httpOnly Cookie 下发
* `tokenVersion` 机制支持服务端踢出（版本不匹配即 401）
* RBAC：`roleGuard('ADMIN')`
* 可选限流：登录 / 刷新 / 改密码等路由使用 `@fastify/rate-limit`
* Helmet + CORS 可配置

示例登录响应（简化）：
```json
{ "accessToken": "<JWT>", "tokenType": "Bearer" }
```

---
## 同步与队列设计
队列（BullMQ）：
| 队列 | 作业 | 作用 |
|------|------|------|
| `SYNC_STARS_QUEUE` | `sync-stars` | 增量/全量抓取 stars 页，ETag 命中返回 304 快速跳过 |
| `MAINTENANCE_QUEUE` | `maintenance` | 清理过期 RefreshToken/队列数据 |
| `AI_SUMMARY_QUEUE` | `ai-summary` / `ai-sweep` | 项目摘要 & 批量扫描 |

默认 job 策略：`attempts + fixed backoff`，完成/失败设置保留上限（防止 Redis 膨胀）。

增量逻辑要点：
* 按页抓取（最大 100 / 页），控制 `perPage`
* 首页带 ETag 条件请求 → 304 时终止
* 支持 `soft delete`（末页未出现的项目可标记归档）

---
## AI 摘要与批处理
* 单项目摘要：读取 README 片段（截断 `aiReadmeMaxChars`）、调用模型生成简介 / 标签
* 批处理（sweep）：筛选未摘要或过期(`aiSummaryStaleDays`) 的项目，入列 `ai-summary` 子任务
* 批处理完成：通过 Redis 计数器触发汇总邮件（最多采样前 20 条成功/失败）
* 速率控制：`AI_RPM_LIMIT` 简单分钟桶 + 等待循环

---
## 维护任务 / 清理策略
每日维护（可配置 cron）：
| 项 | 行为 | 关键配置 |
|----|------|----------|
| Refresh Token | 清理过期/吊销记录 | `RT_*` 系列 |
| BullMQ 数据 | 清理完成/失败任务、裁剪事件 | `BULL_CLEAN_*`, `BULL_TRIM_EVENTS` |
| Dry Run 支持 | 预览不执行 | `BULL_DRY_RUN`, `RT_CLEAN_DRY_RUN` |

---
## 通知邮件
启用条件：`NOTIFY_EMAIL_ENABLED=true` 且 `MAIL_TO` 配置。
事件：同步完成/失败、维护完成/失败、AI 单项目、批量汇总、扫尾失败。
发送失败：通过 `safeSend` 记录 warn，不影响主逻辑（可扩展严格模式）。

---
## 错误模型
统一结构（示例）：
```json
{
  "message": "Forbidden: role USER cannot access this resource",
  "code": 403,
  "errorType": "ForbiddenError",
  "requiredRoles": ["ADMIN"],
  "actualRole": "USER"
}
```
常见类型：ValidationError / UnauthorizedError / ForbiddenError / NotFound / ConflictError / RateLimitError / ExternalServiceError / DependencyUnavailable / TimeoutError / PrismaUniqueError / AppError / Internal

GitHub `RequestError` 会附加 meta：
```json
{"route":"GET /users/{username}/starred","rateLimitRemaining":56,"rateLimitReset":1736823456,"status":200}
```

---
## 可观测性与日志
* 结构化 JSON（启动阶段 / process 级错误）
* BullMQ 事件：completed / failed / error
* GitHub API：失败时附加限流信息（remaining/reset）
* AI 摘要批处理：Redis 计数 + 最终邮件快照

---
## 开发与脚本
| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发启动 (tsx + pino-pretty) |
| `pnpm build` | TypeScript 编译到 `dist/` |
| `pnpm start` | 运行编译产物 |
| `pnpm migrate` | Prisma 本地迁移 (dev) |
| `pnpm migrate:prod` | 生产部署迁移 (deploy) |
| `pnpm seed:admin` | 初始化管理员账户 |
| `pnpm docs` | 生成 OpenAPI / Config / Prisma 文档 |
| `pnpm lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `pnpm test` | Jest 单/集成测试（passWithNoTests） |

生成文档：
```bash
pnpm docs          # openapi.json / docs/config.md / prisma 文档
open docs/openapi.html
```

---
## 测试策略
* 单元测试：service / helper 层（模拟 prisma / redis）
* 集成测试：针对 auth / project 路由（JWT + RBAC）
* 队列测试：使用 `BULL_ROLE=worker` & 内存/本地 Redis
* 断言错误：使用 `AppError` 的 `errorType` / `code`

---
## Roadmap / 可扩展点
| 方向 | 想法 |
|------|------|
| 指标 | Prometheus / OpenTelemetry 导出队列与延迟指标 |
| 断路器 | 针对 GitHub / AI API 增加熔断与半开恢复 |
| 多用户 | 支持多 GitHub 用户配置（拆分 namespace）|
| 审计日志 | 登录 / 权限变更持久化 |
| Webhook | Stars / Repo 事件触发增量更新 |
| 更智能限流 | 自适应速率 + 代价估算 |

---
## 贡献
欢迎 PR / Issue。提交前：
```bash
pnpm lint:fix && pnpm test && pnpm build
```

---
## 许可证
MIT © 2025-present

---
## 参考
* Fastify: https://fastify.dev
* BullMQ: https://docs.bullmq.io
* TypeBox: https://github.com/sinclairzx81/typebox
* Prisma: https://www.prisma.io
* Octokit: https://github.com/octokit/octokit.js
* Nodemailer: https://nodemailer.com
