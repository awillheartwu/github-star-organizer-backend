// Ensure NODE_ENV for config loader
process.env.NODE_ENV = process.env.NODE_ENV || 'test'

// Quiet down noisy logs in unit tests; can be toggled by DEBUG_TESTS
if (!process.env.DEBUG_TESTS) {
  const noop = () => void 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(console as any).debug = noop
}
