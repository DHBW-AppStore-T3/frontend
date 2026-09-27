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

  it('is undefined when VITE_THEME is not set', async () => {
    expect((await loadEnv()).THEME).toBeUndefined()
  })

  it('takes the value from window.__ENV__', async () => {
    window.__ENV__ = { VITE_THEME: 't3-demo' }
    expect((await loadEnv()).THEME).toBe('t3-demo')
  })

  it('ignores the unsubstituted placeholder', async () => {
    window.__ENV__ = { VITE_THEME: '$VITE_THEME' }
    expect((await loadEnv()).THEME).toBeUndefined()
  })

  it('passes through an explicit "default" so SIX7 stays selectable', async () => {
    window.__ENV__ = { VITE_THEME: 'default' }
    expect((await loadEnv()).THEME).toBe('default')
  })

  it('regression: a completely missing VITE_THEME resolves to the t3 theme, not SIX7', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const env = await loadEnv()
    expect(resolveTheme(env.THEME).id).toBe('t3')
    warn.mockRestore()
  })
})
