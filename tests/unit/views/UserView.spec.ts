import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import UserView from '@/views/UserView.vue'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'
import type { UserWithCourse } from '@/types'
let mockUser: Partial<UserWithCourse> | null = null
const success = vi.fn()
vi.mock('@/stores/auth.store', () => ({ useAuthStore: () => ({ get user() { return mockUser } }) }))
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ success }) }))
function mountView() {
  const i18n = createI18n({ legacy: false, locale: 'de', messages: { de, en } })
  return { i18n, wrapper: mount(UserView, { global: { plugins: [i18n], stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } }) }
}
beforeEach(() => { mockUser = null; localStorage.clear(); vi.clearAllMocks() })
describe('User profile', () => {
  it('shows a loading state before the account is available', () => {
    expect(mountView().wrapper.text()).toContain(de.UserView.loading)
  })
  it('shows account-managed identity in read-only fields and retains account details', () => {
    mockUser = { username: 'maxmuster', firstName: 'Max', lastName: 'Mustermann', email: 'max@example.test', role: 'student', userId: 'u-1', keycloak_id: 'kc-1', created_at: '2024-01-15', course: { courseId: 'c-1', name: 'Informatik' } }
    const { wrapper } = mountView()
    const fields = wrapper.findAll('input')
    expect(fields[0]!.element.value).toBe('Max Mustermann')
    expect(fields[1]!.element.value).toBe('max@example.test')
    expect(fields.every(field => field.element.readOnly)).toBe(true)
    for (const value of ['maxmuster', 'Informatik', 'u-1', 'kc-1', '2024']) expect(wrapper.text()).toContain(value)
  })
  it('falls back to the username when personal names are missing', () => {
    mockUser = { username: 'minimalist', role: 'admin' }
    expect(mountView().wrapper.get('input').element.value).toBe('minimalist')
  })
  it('saves the language preference without updating account data', async () => {
    mockUser = { username: 'admin', role: 'admin' }
    const { wrapper, i18n } = mountView()
    await wrapper.get('select').setValue('en')
    await wrapper.get('form').trigger('submit')
    expect(i18n.global.locale.value).toBe('en')
    expect(localStorage.getItem('locale')).toBe('en')
    expect(success).toHaveBeenCalled()
    expect(mockUser).toEqual({ username: 'admin', role: 'admin' })
  })
  it('keeps the credentials settings accessible', () => {
    mockUser = { username: 'admin', role: 'admin' }
    expect(mountView().wrapper.get('a').attributes('href')).toBe('/user/openstack')
  })
})
