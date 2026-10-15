/**
 * Stored XSS (.github#7 J): an app, course, member or deployment name is
 * shown in confirmation dialogs through ``<i18n-t>`` slots, never through
 * ``v-html``. With the real vue-i18n, markup in a name must stay text.
 */
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent } from 'vue'

import i18n from '@/i18n'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

const PAYLOAD = '<img src=x onerror="window.__pwned = true">'

const KEYS: Array<[string, string]> = [
  ['AppsDetailView.confirmDeleteMessage', 'name'],
  ['CoursesView.deleteModal.confirmPrompt', 'name'],
  ['CourseDetailView.removeModal.confirmPrompt', 'username'],
  ['DeploymentDetailView.confirmStopMessage', 'name'],
  ['DeploymentDetailView.confirmDeleteMessage', 'name'],
  ['DeploymentDetailView.confirmPauseMessage', 'name'],
  ['DeploymentDetailView.confirmResumeMessage', 'name'],
]

function lookup(messages: Record<string, unknown>, key: string): string {
  return key.split('.').reduce<any>((node, part) => node?.[part], messages) as string
}

describe('names in confirmation messages', () => {
  it.each(KEYS)('%s renders the name as text', (keypath, slot) => {
    const Probe = defineComponent({
      props: { name: { type: String, required: true } },
      template: `<i18n-t keypath="${keypath}" tag="p"><template #${slot}><strong>{{ name }}</strong></template></i18n-t>`,
    })
    const wrapper = mount(Probe, {
      props: { name: PAYLOAD },
      global: { plugins: [i18n], stubs: { 'i18n-t': false, I18nT: false } },
    })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.find('strong').text()).toBe(PAYLOAD)
    expect((window as any).__pwned).toBeUndefined()
  })

  it.each(KEYS)('%s carries no markup of its own', (keypath) => {
    for (const messages of [de, en]) {
      const text = lookup(messages as Record<string, unknown>, keypath)
      expect(text).toBeTypeOf('string')
      expect(text).not.toMatch(/<[a-z]/i)
    }
  })
})
