import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import ForbiddenView from '@/views/ForbiddenView.vue'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

const mockReplace = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

function mountView(locale: 'de' | 'en' = 'de') {
  const i18n = createI18n({ legacy: false, locale, messages: { de, en } })
  return mount(ForbiddenView, { global: { plugins: [i18n], stubs: { ShieldAlert: true } } })
}

beforeEach(() => {
  mockReplace.mockClear()
})

describe('ForbiddenView', () => {
  it('renders the access-denied message', () => {
    const wrapper = mountView()
    expect(wrapper.text()).toContain(de.ForbiddenView.title)
    expect(wrapper.text()).toContain(de.ForbiddenView.description)
  })

  it('renders in english when locale is en', () => {
    const wrapper = mountView('en')
    expect(wrapper.text()).toContain(en.ForbiddenView.title)
  })

  it('navigates back to the dashboard on click', async () => {
    const wrapper = mountView()
    await wrapper.get('button').trigger('click')
    expect(mockReplace).toHaveBeenCalledWith('/dashboard')
  })
})
