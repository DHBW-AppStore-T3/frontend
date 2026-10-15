import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// RTL only auto-registers cleanup when the test runner exposes global
// `afterEach` at import time; register it explicitly to be independent of that.
afterEach(() => {
  cleanup()
})
