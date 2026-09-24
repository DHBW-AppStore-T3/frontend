import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { ref } from 'vue'

import DashboardView from '@/views/DashboardView.vue'

// ---------------------------------------------------------------
// Rewritten from a `describe.skip` dated 2026-06-29. The TODO cited a
// layout rebuild (recent-activity removed, useRole as a tile gate,
// i18n subtitle) as the reason for skipping.
//
// Three of the five original tests reached through `wrapper.vm` to read
// `firstName` and `timeGreeting` directly. That is testing the
// implementation, not the page: the names are internals of
// `<script setup>`, and a rename would break the test while the
// rendered greeting stayed correct. They now assert the greeting the
// user actually sees.
//
// The two lifecycle tests were sound and are kept, plus coverage for
// the staff-only tile gate that the rebuild introduced and nothing
// tested.
// ---------------------------------------------------------------

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

let mockUser: any = { username: 'john' }
let mockCredStatus: any = false
let mockQuotasLoading = false
const mockIsStaff = ref(false)

const mockFetchStats = vi.fn()
const mockFetchQuotas = vi.fn()
const mockFetchCredentials = vi.fn()

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    get user() { return mockUser },
  }),
}))

vi.mock('@/stores/openstack-credentials.store', () => ({
  useOpenStackCredentialsStore: () => ({
    get status() { return mockCredStatus },
    isResolved: false,
    hasCredential: true,
    lastError: null,
    fetch: mockFetchCredentials,
  }),
}))

vi.mock('@/composables/useDashboard', () => ({
  useDashboard: () => ({
    stats: { deployments: 3, apps: 7, courses: 2 },
    fetchStats: mockFetchStats,
  }),
}))

vi.mock('@/composables/useQuotas', () => ({
  useQuotas: () => ({
    formattedQuotas: [],
    get loading() { return mockQuotasLoading },
    needsCredentials: false,
    hasCachedQuotas: true,
    fetchQuotas: mockFetchQuotas,
    getColorClass: vi.fn(),
  }),
}))

vi.mock('@/composables/useRole', () => ({
  useRole: () => ({ isStaff: mockIsStaff }),
}))

const mountView = () =>
  mount(DashboardView, {
    global: {
      mocks: {
        $t: (key: string, vars?: any) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
      },
      stubs: {
        RouterLink: RouterLinkStub,
        CredentialMissingBanner: true,
      },
    },
  })

describe('DashboardView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = { username: 'john' }
    mockCredStatus = false
    mockQuotasLoading = false
    mockIsStaff.value = false

    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 7, 14, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('loads stats, quotas and credentials on mount', async () => {
    mountView()
    await flushPromises()

    expect(mockFetchStats).toHaveBeenCalledTimes(1)
    expect(mockFetchQuotas).toHaveBeenCalledTimes(1)
    expect(mockFetchCredentials).toHaveBeenCalledTimes(1)
  })

  it('does not re-fetch credentials that are already loaded', async () => {
    mockCredStatus = { some: 'status' }

    mountView()
    await flushPromises()

    expect(mockFetchCredentials).not.toHaveBeenCalled()
  })

  it('greets the user by a capitalised username', () => {
    mockUser = { username: 'maximilian' }

    expect(mountView().text()).toContain('Maximilian')
  })

  it('renders without a name when no user is loaded yet', () => {
    mockUser = null

    // The greeting line is still there; it just has no name in it.
    const wrapper = mountView()
    expect(wrapper.text()).toContain('DashboardView.timeGreetings.afternoon')
  })

  it.each([
    [9, 'DashboardView.timeGreetings.morning'],
    [14, 'DashboardView.timeGreetings.afternoon'],
    [20, 'DashboardView.timeGreetings.evening'],
  ])('greets according to the hour (%i:00)', (hour, expected) => {
    vi.setSystemTime(new Date(2026, 5, 7, hour as number, 0, 0))

    expect(mountView().text()).toContain(expected)
  })

  it('hides the courses tile from non-staff users', () => {
    mockIsStaff.value = false

    const targets = mountView()
      .findAllComponents(RouterLinkStub)
      .map((l) => l.props('to'))

    expect(targets).not.toContain('/courses')
  })

  it('shows the courses tile to staff', () => {
    mockIsStaff.value = true

    const targets = mountView()
      .findAllComponents(RouterLinkStub)
      .map((l) => l.props('to'))

    expect(targets).toContain('/courses')
  })
})
