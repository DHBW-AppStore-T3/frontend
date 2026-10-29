import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { networkGuard } from './helpers/network-guard'

beforeEach(() => {
  networkGuard.install()
})

// RTL only auto-registers cleanup when the test runner exposes global
// `afterEach` at import time; register it explicitly to be independent of that.
afterEach(() => {
  try {
    cleanup()
  } finally {
    networkGuard.uninstall()
  }
  // Code under test often swallows a rejected request: fail the test anyway.
  const violations = networkGuard.takeViolations()
  if (violations.length > 0 && process.env.NETWORK_GUARD !== 'warn') {
    const list = violations.map((v) => `  ${v.method} ${v.url}`).join('\n')
    throw new Error(`Unmocked network request(s) in "${violations[0].test}":\n${list}`)
  }
})
