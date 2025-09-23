// test/helpers/database.helper.ts
import { PrismaClient } from '@prisma/client'
import { execSync } from 'node:child_process'
import path from 'node:path'

export class TestDatabase {
  private static instance: PrismaClient | null = null
  private static migrated = false

  private static resolveDatabaseUrl(): string {
    const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL
    if (!url) {
      throw new Error(
        'TEST_DATABASE_URL 或 DATABASE_URL 未设置，无法初始化测试数据库 (PostgreSQL)。'
      )
    }
    return url
  }

  private static runMigrations(databaseUrl: string): void {
    if (this.migrated) return

    const repoRoot = path.resolve(__dirname, '..', '..')
    execSync('npx prisma migrate deploy', {
      cwd: repoRoot,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    })
    this.migrated = true
  }

  static async setup(): Promise<PrismaClient> {
    if (!this.instance) {
      const databaseUrl = this.resolveDatabaseUrl()
      this.runMigrations(databaseUrl)

      this.instance = new PrismaClient({
        datasources: { db: { url: databaseUrl } },
      })
      await this.instance.$connect()
    }
    return this.instance
  }

  static async cleanup(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect()
      this.instance = null
    }
  }

  static async clearAll(): Promise<void> {
    if (!this.instance) return

    const truncateSql = `
      TRUNCATE TABLE
        "ProjectTag",
        "VideoLink",
        "AiSummary",
        "RefreshToken",
        "ArchivedProject",
        "SyncState",
        "Project",
        "Tag",
        "User"
      RESTART IDENTITY CASCADE;
    `

    try {
      await this.instance.$executeRawUnsafe(truncateSql)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[TestDatabase] 清理数据失败:', message)
    }
  }

  static getInstance(): PrismaClient {
    if (!this.instance) {
      throw new Error('Database not initialized. Call TestDatabase.setup() first.')
    }
    return this.instance
  }
}
