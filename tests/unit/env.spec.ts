import { describe, it, expect, beforeEach, vi } from 'vitest'
import { resolveTheme } from '@/theme'

async function loadEnv() {
  vi.resetModules()
  return (await import('@/env')).env
}

describe('env.THEME', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    window.__ENV__ = {}
  })

  it('selects T3 when no theme is configured', async () => {
    expect(resolveTheme((await loadEnv()).THEME).id).toBe('t3')
  })

  it('passes through an explicit T3 selection', async () => {
    window.__ENV__ = { VITE_THEME: 't3' }
    expect((await loadEnv()).THEME).toBe('t3')
  })

  it('ignores the unsubstituted placeholder', async () => {
    window.__ENV__ = { VITE_THEME: '$VITE_THEME' }
    expect((await loadEnv()).THEME).toBeUndefined()
  })

  it('falls back to T3 for an unregistered selection', async () => {
    window.__ENV__ = { VITE_THEME: 'unknown' }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveTheme((await loadEnv()).THEME).id).toBe('t3')
    expect(warn).toHaveBeenCalledOnce()
    warn.mockRestore()
  })
})
