import { describe, it, expect } from 'vitest'

// Importing this module executes readSavedLocale() and createI18n() at module
// level — that alone covers all reachable statements in the file.
describe('i18n/index — module-level boot', () => {
  it('exports a working i18n instance', async () => {
    const { default: i18n } = await import('@/i18n')
    expect(i18n).toBeDefined()
    expect(typeof i18n.global.t).toBe('function')
  })

  it('default locale is "de"', async () => {
    const { default: i18n } = await import('@/i18n')
    expect(i18n.global.locale.value).toBe('de')
  })
})
