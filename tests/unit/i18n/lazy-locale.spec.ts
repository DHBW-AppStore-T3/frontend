import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { waitFor } from '@testing-library/react'
import i18n, { loadLocale, loadActiveLocale, switchLocale } from '@/i18n'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

// #148: the app registers one language at start and the other one on demand.
// tests/setup.ts registers both for the other specs; these specs unload one.
const unload = (lng: 'de' | 'en') => i18n.removeResourceBundle(lng, 'translation')

beforeEach(async () => {
  localStorage.clear()
  await loadLocale('de')
  await loadLocale('en')
  await i18n.changeLanguage('de')
})

afterEach(async () => {
  await loadLocale('de')
  await loadLocale('en')
  await i18n.changeLanguage('de')
})

describe('lazy locales', () => {
  it('loadLocale registers a missing language once and keeps the loaded one', async () => {
    unload('en')
    expect(i18n.hasResourceBundle('en', 'translation')).toBe(false)

    await loadLocale('en')

    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true)
    expect(i18n.getResource('en', 'translation', 'workspace.profile')).toBe(en.workspace.profile)
    await loadLocale('en')
    expect(i18n.getResource('en', 'translation', 'workspace.profile')).toBe(en.workspace.profile)
  })

  it('loadActiveLocale loads the saved language before the first render', async () => {
    localStorage.setItem('locale', 'en')
    unload('en')

    await loadActiveLocale()

    expect(i18n.hasResourceBundle('en', 'translation')).toBe(true)
  })

  it('switching to a language that is not loaded yet loads it first, then switches', async () => {
    unload('en')

    switchLocale('en')
    expect(i18n.language).toBe('de') // not switched before the messages are there
    expect(localStorage.getItem('locale')).toBe('en')

    await waitFor(() => expect(i18n.language).toBe('en'))
    expect(i18n.t('workspace.profile')).toBe(en.workspace.profile)
  })

  it('switching to a loaded language is immediate', async () => {
    switchLocale('en')
    await waitFor(() => expect(i18n.language).toBe('en'))
    switchLocale('de')
    await waitFor(() => expect(i18n.language).toBe('de'))
    expect(i18n.t('workspace.profile')).toBe(de.workspace.profile)
  })

  it('a German start needs no English messages (no key shows up as text)', async () => {
    unload('en')
    expect(i18n.t('workspace.profile')).toBe(de.workspace.profile)
    expect(i18n.t('auth.login.language')).not.toBe('auth.login.language')
  })
})
