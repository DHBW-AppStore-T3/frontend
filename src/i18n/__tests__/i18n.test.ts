import { describe, it, expect, beforeEach } from 'vitest'
import i18n from '@/i18n'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'
import { translateHtml } from '@/i18n/html'

function leafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object'
      ? leafKeys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  )
}

describe('i18n', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en')
  })

  it('interpolates {name} placeholders as used in the existing locale files', () => {
    expect(i18n.t('workspace.profile')).toBe('Profile')
    expect(i18n.t('CoursesView.deleteModal.confirmPrompt', { name: 'Math' })).toContain(
      '<strong>Math</strong>',
    )
  })

  it('switches language', async () => {
    await i18n.changeLanguage('de')
    expect(i18n.t('workspace.profile')).toBe(de.workspace.profile)
  })

  it('pluralises with count', () => {
    expect(i18n.t('DeploymentDetailView.deploymentStudentCount', { count: 1 })).toBe('1 Student')
    expect(i18n.t('DeploymentDetailView.deploymentStudentCount', { count: 3 })).toBe('3 Students')
  })

  it('has identical key sets in de and en', () => {
    const deKeys = new Set(leafKeys(de))
    const enKeys = new Set(leafKeys(en))
    expect([...deKeys].filter((k) => !enKeys.has(k))).toEqual([])
    expect([...enKeys].filter((k) => !deKeys.has(k))).toEqual([])
  })

  it('translateHtml escapes interpolated params so user data cannot inject markup', () => {
    const out = translateHtml('CoursesView.deleteModal.confirmPrompt', {
      name: '<img src=x onerror=alert(1)>',
    })
    expect(out).toContain('<strong>')
    expect(out).not.toContain('<img')
    expect(out).toContain('&lt;img')
  })
})
