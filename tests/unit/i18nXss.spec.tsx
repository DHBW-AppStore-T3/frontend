/**
 * Stored XSS (.github#7 J): an app, course, member or deployment name is shown
 * in confirmation dialogs through `BoldSlot` (a text child), never as HTML.
 * With the real i18n, markup in a name must stay text.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'

import i18n from '@/i18n'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'
import BoldSlot from '@/i18n/BoldSlot'

const PAYLOAD = '<img src=x onerror="window.__pwned = true">'

const KEYS: Array<[string, string]> = [
  ['AppsDetailView.confirmDeleteMessage', 'name'],
  ['CoursesView.deleteModal.confirmPrompt', 'name'],
  ['CourseDetailView.removeModal.confirmPrompt', 'username'],
  ['DeploymentDetailView.confirmStopMessage', 'name'],
  ['DeploymentDetailView.confirmDeleteMessage', 'name'],
  ['DeploymentDetailView.confirmPauseMessage', 'name'],
  ['DeploymentDetailView.confirmResumeMessage', 'name'],
  ['DeploymentDetailView.confirmStopMessagePods', 'name'],
  ['DeploymentDetailView.confirmDeleteMessagePods', 'name'],
  ['DeploymentDetailView.confirmPauseMessagePods', 'name'],
  ['DeploymentDetailView.confirmResumeMessagePods', 'name'],
  ['pods.confirmResetMessage', 'workload'],
]

function lookup(messages: Record<string, unknown>, key: string): string {
  return key.split('.').reduce<any>((node, part) => node?.[part], messages) as string
}

describe('names in confirmation messages', () => {
  it.each(KEYS)('%s renders the name as text', (key, slot) => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <p>
          <BoldSlot i18nKey={key} slot={slot} value={PAYLOAD} />
        </p>
      </I18nextProvider>,
    )

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('strong')?.textContent).toBe(PAYLOAD)
    expect((window as any).__pwned).toBeUndefined()
  })

  it.each(KEYS)('%s carries no markup of its own', (key) => {
    for (const messages of [de, en]) {
      const text = lookup(messages as Record<string, unknown>, key)
      expect(text).toBeTypeOf('string')
      expect(text).not.toMatch(/<[a-z]/i)
    }
  })
})
