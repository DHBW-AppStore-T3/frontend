import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import { networkGuard } from './helpers/network-guard'

// Node 25 ships `localStorage` as an empty object `{}` without setItem/getItem,
// which breaks Zustand's persist middleware. Patch it with a working in-memory
// implementation so every test environment gets a functional store.
if (typeof (globalThis.localStorage as { setItem?: unknown })?.setItem !== 'function') {
  const _data: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => _data[k] ?? null,
      setItem: (k: string, v: string) => { _data[k] = v },
      removeItem: (k: string) => { delete _data[k] },
      clear: () => { Object.keys(_data).forEach(k => delete _data[k]) },
      get length() { return Object.keys(_data).length },
      key: (i: number) => Object.keys(_data)[i] ?? null,
    },
    writable: true,
    configurable: true,
  })
}

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
