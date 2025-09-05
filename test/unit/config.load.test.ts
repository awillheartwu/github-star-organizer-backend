import { normalizeErrorMessage } from '../../src/services/sync.state.service'

describe('utility functions', () => {
  test('normalizeErrorMessage truncates long messages and extracts from Error', () => {
    expect(normalizeErrorMessage(new Error('boom'))).toBe('boom')
    const long = 'x'.repeat(600)
    expect(normalizeErrorMessage(long).length).toBe(500)
  })
})
