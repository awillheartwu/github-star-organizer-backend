# Prisma Schema Documentation

## Enums
### ArchivedReason
归档原因
Values:
- manual — 手动删除
- unstarred — 同步检测到已取消 star

### AiSummaryStyle
历史 AI 摘要（便于追溯不同模型/时间的结果）
Values:
- short
- long

### UserRole
用户角色
Values:
- USER
- ADMIN

## Models
### Project
GitHub 项目（来自 stars 同步）与用户侧标注信息
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| id | String | @id @default(uuid()) | 主键，UUID |
| githubId | Int | @unique | GitHub 项目的唯一 ID（来自 GitHub API） |
| name | String |  | 仓库名称（如 star-organizer） |
| fullName | String |  | 仓库全名（如 user/star-organizer） |
| url | String |  | 仓库链接 |
| description | String? |  | 项目描述 |
| language | String? |  | 主语言 |
| stars | Int | @default(0) | Star 数量 |
| forks | Int | @default(0) | Fork 数量 |
| lastCommit | DateTime? |  | 最后一次提交时间（可选） |
| lastSyncAt | DateTime | @default(now()) | 最后同步时间 |
| touchedAt | DateTime? |  | 最近一次被同步任务“触达”的时间（内容未变也会更新） |
| notes | String? |  | 用户备注 |
| favorite | Boolean | @default(false) | 是否标记为收藏 |
| archived | Boolean | @default(false) | 是否归档 |
| pinned | Boolean | @default(false) | 是否置顶 |
| score | Int? |  | 用户评分（可选） |
| videoLinks | VideoLink[] |  | 关联的视频链接（多对一） |
| summaryShort | String? |  | 最新 AI 摘要（短） |
| summaryLong | String? |  | 最新 AI 摘要（长） |
| tags | ProjectTag[] |  | 项目关联的标签（多对多） |
| createdAt | DateTime | @default(now()) | 创建时间 |
| updatedAt | DateTime | @default(now()) @updatedAt | 更新时间（自动更新） |
| deletedAt | DateTime? |  | 软删除时间（可选） |
| AiSummary | AiSummary[] |  |  |

### AiSummary
AI 摘要历史记录
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| id | String | @id @default(uuid()) | 主键 |
| projectId | String |  | 所属项目 |
| project | Project | @relation(fields: [projectId], references: [id]) | 外键 |
| style | AiSummaryStyle |  | 摘要风格 |
| content | String |  | 使用的模型 |
| model | String? |  | 模型名称 |
| lang | String? |  | 模型版本 |
| tokens | Int? |  | 使用的 tokens 数（可选） |
| createdAt | DateTime | @default(now()) |  |

### Tag
标签表
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| id | String | @id @default(uuid()) | 主键，UUID |
| name | String |  | 标签名称（不再唯一，靠软删区分） |
| description | String? |  | 标签描述（可选） |
| projects | ProjectTag[] |  | 拥有该标签的项目（多对多） |
| archived | Boolean | @default(false) | 是否归档 |
| createdAt | DateTime | @default(now()) | 创建时间 |
| updatedAt | DateTime | @default(now()) @updatedAt | 更新时间（自动更新） |
| deletedAt | DateTime? |  | 软删除时间（可选） |

### ProjectTag
项目-标签 关联表
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| project | Project | @relation(fields: [projectId], references: [id]) | 外键关联 Project |
| projectId | String |  |  |
| tag | Tag | @relation(fields: [tagId], references: [id]) | 外键关联 Tag |
| tagId | String |  |  |

### VideoLink
视频链接
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| id | String | @id @default(uuid()) | 主键 |
| url | String |  | 视频链接 |
| project | Project | @relation(fields: [projectId], references: [id]) | 所属项目 |
| projectId | String |  | 外键 |
| archived | Boolean | @default(false) | 是否归档 |
| createdAt | DateTime | @default(now()) | 创建时间 |
| updatedAt | DateTime | @default(now()) @updatedAt | 更新时间（自动更新） |
| deletedAt | DateTime? |  | 软删除时间（可选） |

### User
用户表
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| id | String | @id @default(uuid()) | 主键，UUID |
| email | String | @unique | 用户邮箱 |
| passwordHash | String |  | 密码哈希 |
| displayName | String? |  | 显示名称 |
| role | UserRole | @default(USER) | 用户角色 |
| tokenVersion | Int | @default(0) | 令牌版本（用于刷新令牌的无状态撤销） |
| createdAt | DateTime | @default(now()) |  |
| updatedAt | DateTime | @default(now()) @updatedAt |  |
| refreshTokens | RefreshToken[] |  |  |

### RefreshToken
Refresh Token（仅存哈希）
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| id | String | @id @default(uuid()) |  |
| userId | String |  | 所属用户 |
| user | User | @relation(fields: [userId], references: [id], onDelete: Cascade) |  |
| tokenHash | String | @unique | 只存哈希（避免明文落库） |
| jti | String | @unique |  |
| revoked | Boolean | @default(false) | 只存哈希（避免明文落库） |
| replacedByTokenId | String? |  | 替换的令牌 ID（可选，用于单点登录等） |
| expiresAt | DateTime |  | 过期时间 |
| createdAt | DateTime | @default(now()) |  |
| revokedAt | DateTime? |  |  |
| ip | String? |  | ip 地址与 user-agent（可选，用于审计） |
| userAgent | String? |  |  |

### SyncState
记录各类同步任务的游标与状态 兼容多来源与多任务，通过 (source, key) 唯一定位。
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| id | String | @id @default(uuid()) |  |
| source | String |  | 同步来源：例如 'github:stars' |
| key | String |  | 任务键：例如 'user:YOUR_GITHUB_USERNAME' |
| cursor | String? |  | 用于增量同步的游标（例如 GitHub starred_at 的 ISO 字符串） e.g. "2025-09-01T05:11:22Z" |
| etag | String? |  | HTTP ETag（If-None-Match/304），可选加速 |
| lastRunAt | DateTime? |  | 最近一次运行时间/成功时间/失败时间 |
| lastSuccessAt | DateTime? |  |  |
| lastErrorAt | DateTime? |  |  |
| lastError | String? |  | 最近一次错误信息（简要） |
| statsJson | String? |  | 最近一次统计信息（JSON 串，记录 created/updated 等） |
| createdAt | DateTime | @default(now()) |  |
| updatedAt | DateTime | @default(now()) @updatedAt |  |

### ArchivedProject
归档的 Project 快照（允许同一 githubId 多次归档）
| Field | Type | Attributes | Description |
|------|------|------------|-------------|
| id | String | @id @default(uuid()) |  |
| githubId | Int? |  | GitHub 项目 ID（非唯一，允许多次归档） |
| originalProjectId | String? |  |  |
| reason | ArchivedReason |  | 归档理由 |
| snapshot | Json |  | 归档时的完整项目信息快照（JSON） |
| archivedAt | DateTime | @default(now()) |  |
