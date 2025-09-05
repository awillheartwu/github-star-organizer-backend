// Mock config to avoid loading full .env in this unit and breaking on strict validation
jest.mock('../../src/config', () => ({ config: { jwtRefreshExpires: '7d' } }))
import { hashPassword, verifyPassword, sha256 } from '../../src/services/auth.service'

describe('auth.service crypto helpers', () => {
  test('sha256 deterministic', () => {
    expect(sha256('abc')).toBe(sha256('abc'))
    expect(sha256('abc')).not.toBe(sha256('abcd'))
  })

  test('argon2 hash/verify works', async () => {
    const hash = await hashPassword('p@ssw0rd')
    expect(hash).toMatch(/^\$argon2/)
    expect(await verifyPassword(hash, 'p@ssw0rd')).toBe(true)
    expect(await verifyPassword(hash, 'wrong')).toBe(false)
  })
})
