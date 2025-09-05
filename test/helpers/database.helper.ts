// test/helpers/database.helper.ts
import { PrismaClient } from '@prisma/client'

export class TestDatabase {
  private static instance: PrismaClient | null = null
  private static readonly TEST_DATABASE_URL = 'file:./test.db'

  static async setup(): Promise<PrismaClient> {
    if (!this.instance) {
      this.instance = new PrismaClient({
        datasources: { db: { url: this.TEST_DATABASE_URL } },
      })

      await this.instance.$connect()

      // 手动创建表结构而不是依赖迁移
      await this.createTables()
    }
    return this.instance
  }

  private static async createTables(): Promise<void> {
    if (!this.instance) return

    // 创建所有必要的表
    await this.instance.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "passwordHash" TEXT NOT NULL,
        "displayName" TEXT,
        "role" TEXT NOT NULL DEFAULT 'USER',
        "tokenVersion" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await this.instance.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RefreshToken" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "tokenHash" TEXT NOT NULL UNIQUE,
        "jti" TEXT NOT NULL UNIQUE,
        "revoked" BOOLEAN NOT NULL DEFAULT false,
        "replacedByTokenId" TEXT,
        "expiresAt" DATETIME NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "revokedAt" DATETIME,
        "ip" TEXT,
        "userAgent" TEXT,
        FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
      )
    `)

    await this.instance.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Project" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "githubId" INTEGER NOT NULL UNIQUE,
        "name" TEXT NOT NULL,
        "fullName" TEXT NOT NULL,
        "url" TEXT NOT NULL,
        "description" TEXT,
        "language" TEXT,
        "stars" INTEGER NOT NULL DEFAULT 0,
        "forks" INTEGER NOT NULL DEFAULT 0,
        "lastCommit" DATETIME,
        "lastSyncAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "touchedAt" DATETIME,
        "notes" TEXT,
        "favorite" BOOLEAN NOT NULL DEFAULT false,
        "archived" BOOLEAN NOT NULL DEFAULT false,
        "pinned" BOOLEAN NOT NULL DEFAULT false,
        "score" INTEGER,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" DATETIME
      )
    `)

    await this.instance.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Tag" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "archived" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" DATETIME
      )
    `)

    await this.instance.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ProjectTag" (
        "projectId" TEXT NOT NULL,
        "tagId" TEXT NOT NULL,
        PRIMARY KEY ("projectId", "tagId"),
        FOREIGN KEY ("projectId") REFERENCES "Project" ("id"),
        FOREIGN KEY ("tagId") REFERENCES "Tag" ("id")
      )
    `)

    await this.instance.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "VideoLink" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "url" TEXT NOT NULL,
        "projectId" TEXT NOT NULL,
        "archived" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "deletedAt" DATETIME,
        FOREIGN KEY ("projectId") REFERENCES "Project" ("id")
      )
    `)

    await this.instance.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SyncState" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "source" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "cursor" TEXT,
        "etag" TEXT,
        "lastRunAt" DATETIME,
        "lastSuccessAt" DATETIME,
        "lastErrorAt" DATETIME,
        "lastError" TEXT,
        "statsJson" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("source", "key")
      )
    `)

    await this.instance.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ArchivedProject" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "githubId" INTEGER,
        "originalProjectId" TEXT,
        "reason" TEXT NOT NULL,
        "snapshot" TEXT NOT NULL,
        "archivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)
  }

  static async cleanup(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect()
      this.instance = null
    }
  }

  static async clearAll(): Promise<void> {
    if (!this.instance) return

    // 按依赖关系清理表
    const tables = [
      'ProjectTag',
      'VideoLink',
      'RefreshToken',
      'ArchivedProject',
      'SyncState',
      'Project',
      'Tag',
      'User',
    ]

    for (const table of tables) {
      try {
        await this.instance.$executeRawUnsafe(`DELETE FROM ${table}`)
      } catch (error) {
        // 如果表不存在，忽略错误（测试数据库可能不完整）
        console.warn(`Warning: Could not clear table ${table}:`, error.message)
      }
    }
  }

  static getInstance(): PrismaClient {
    if (!this.instance) {
      throw new Error('Database not initialized. Call TestDatabase.setup() first.')
    }
    return this.instance
  }
}
