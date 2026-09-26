import { describe, it, expect, beforeEach, vi } from 'vitest'

async function loadEnv() {
  vi.resetModules()
  return (await import('@/env')).env
}

describe('env.THEME', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    window.__ENV__ = {}
  })

  it('defaults to "default"', async () => {
    expect((await loadEnv()).THEME).toBe('default')
  })

  it('takes the value from window.__ENV__', async () => {
    window.__ENV__ = { VITE_THEME: 't3-demo' }
    expect((await loadEnv()).THEME).toBe('t3-demo')
  })

  it('ignores the unsubstituted placeholder', async () => {
    window.__ENV__ = { VITE_THEME: '$VITE_THEME' }
    expect((await loadEnv()).THEME).toBe('default')
  })
})
