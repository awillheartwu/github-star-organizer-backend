const path = require('node:path')

// Detect whether the current invocation is a filtered/partial test run.
function isFilteredRun() {
  if (process.env.DEBUG_JEST_CONFIG === '1') {
    // eslint-disable-next-line no-console
    console.log('[jest-config] process.argv:', JSON.stringify(process.argv))
  }

  const argv = process.argv.slice(2)
  const flagsWithValue = new Set(['--config', '--maxWorkers', '--selectProjects'])
  const filterFlags = new Set([
    '--watch',
    '--watchAll',
    '--onlyChanged',
    '--findRelatedTests',
    '--runTestsByPath',
    '--testPathPattern',
    '--changedSince',
    '--changedFilesWithAncestor',
  ])

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (flagsWithValue.has(arg)) {
      i += 1
      continue
    }
    if (filterFlags.has(arg)) {
      return true
    }
    if (arg === '--') {
      // Everything after "--" is treated as positional filters by Jest.
      return argv.length > i + 1
    }
    if (!arg.startsWith('-')) {
      // Any bare argument (e.g. pattern/path) indicates a filtered run.
      return true
    }
  }

  return false
}

function shouldCollectCoverage() {
  const env = process.env.JEST_COVERAGE
  if (env === '0' || env === 'false') return false
  if (env === '1' || env === 'true' || env === 'always') return true
  return !isFilteredRun()
}

const collectCoverage = shouldCollectCoverage()

/** @type {import('jest').Config} */
const config = {
  rootDir: path.resolve(__dirname, '..'),
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: ['**/?(*.)+(test).ts'],
  transform: {
    '^.+\\.(t|j)s$': 'babel-jest',
  },
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/test/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/test/debug/'],
  collectCoverage,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/generated/**',
    '!src/**/*.d.ts',
    '!src/main.ts',
    '!src/app.ts',
    'src/controllers/auth.controller.ts',
    '!src/routes/**',
    '!src/schemas/**',
    '!src/plugins/**',
    '!src/config/**',
    '!src/scripts/**',
    '!src/types/**',
    '!src/utils/**',
    '!src/services/github/**',
    '!src/services/ai.client.ts',
    '!src/controllers/index.ts',
    '!src/controllers/admin.controller.ts',
    '!src/controllers/project.controller.ts',
    '!src/controllers/tag.controller.ts',
    '!src/controllers/ai.controller.ts',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/plugins/(prisma|redis|rate-limit|sensible|mailer|bullmq)\\.ts',
    '<rootDir>/src/schemas/admin.schema.ts',
    '<rootDir>/src/services/maintenance.service.ts',
    '<rootDir>/src/services/github/',
    '<rootDir>/src/services/ai.client.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: collectCoverage
    ? {
        global: {
          statements: 80,
          branches: 70,
          functions: 80,
          lines: 80,
        },
        'src/services/': {
          statements: 85,
          branches: 70,
          functions: 90,
          lines: 88,
        },
      }
    : undefined,
  verbose: true,
  maxWorkers: 1,
  forceExit: true,
}

module.exports = config
