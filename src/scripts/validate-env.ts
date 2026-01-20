import { loadConfig } from '../config/loadConfig.config'

// Validate production env in CI before deploy.
process.env.NODE_ENV = 'production'

try {
  loadConfig()
  // eslint-disable-next-line no-console
  console.log('env validation: ok')
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  // eslint-disable-next-line no-console
  console.error(`env validation: failed - ${message}`)
  process.exit(1)
}
