import path from 'node:path'
import { config as loadEnv } from 'dotenv'

// Ensure NODE_ENV for config loader
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

// Load env files so DATABASE_URL/TEST_DATABASE_URL exist for helpers needing Prisma
const repoRoot = process.cwd()
loadEnv({ path: path.join(repoRoot, '.env') })
loadEnv({ path: path.join(repoRoot, '.env.test'), override: true })
if (!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL
}

// Quiet down noisy logs in unit tests; can be toggled by DEBUG_TESTS
if (!process.env.DEBUG_TESTS) {
  const noop = () => void 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(console as any).debug = noop
}
