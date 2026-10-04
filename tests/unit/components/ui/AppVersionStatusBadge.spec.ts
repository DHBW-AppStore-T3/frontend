import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge.vue'
import de from '@/i18n/locales/de'

const i18n = createI18n({ legacy: false, locale: 'de', messages: { de } })

function mountBadge(status: string) {
  return mount(AppVersionStatusBadge, {
    props: { status: status as never },
    global: { plugins: [i18n] },
  })
}

describe('AppVersionStatusBadge', () => {
  it.each([
    ['new', 'bg-surfaceMuted'],
    ['pending', 'bg-warningTint'],
    ['approved', 'bg-successTint'],
    ['published', 'bg-successTint'],
    ['rejected', 'bg-dangerTint'],
    ['private', 'bg-brandAccentSoft'],
  ])('maps %s to the matching Badge variant background', (status, expectedClass) => {
    const wrapper = mountBadge(status)
    expect(wrapper.classes().join(' ')).toContain(expectedClass)
  })

  it('renders no raw Tailwind palette classes', () => {
    const wrapper = mountBadge('published')
    expect(wrapper.classes().join(' ')).not.toMatch(/\b(green|red|blue|purple|yellow|gray)-\d/)
  })
})
