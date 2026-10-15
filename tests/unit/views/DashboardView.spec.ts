import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { reactive, ref } from 'vue'

import DashboardView from '@/views/DashboardView.vue'
import CredentialMissingBanner from '@/components/CredentialMissingBanner.vue'

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
let mockQuotasLoading = false
const mockIsStaff = ref(false)

// Credentials store state (reactive like the Pinia store, so the page
// re-renders after a fetch); `credsAfterFetch` is what a fetch() loads.
const credState = reactive({
  isResolved: false,
  usable: [] as any[],
  unverified: [] as any[],
  failing: [] as any[],
})
let credsAfterFetch: any[] = []
const mockQuotaCredentialId = ref<string | null>(null)

const cred = (credentialId: string, project_name: string) => ({
  credentialId, project_name, project_id: `p-${credentialId}`, project_verified: true, last_validation_error: null,
})

const mockFetchStats = vi.fn()
const mockFetchQuotas = vi.fn()
const mockSelectCredential = vi.fn((id: string | null) => { mockQuotaCredentialId.value = id })
const mockFetchCredentials = vi.fn(async () => {
  credState.isResolved = true
  credState.usable = credsAfterFetch
})

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    get user() { return mockUser },
  }),
}))

vi.mock('@/stores/openstack-credentials.store', () => ({
  useOpenStackCredentialsStore: () => ({
    get isResolved() { return credState.isResolved },
    get usable() { return credState.usable },
    get unverified() { return credState.unverified },
    get failing() { return credState.failing },
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
    credentialId: mockQuotaCredentialId,
    formattedQuotas: [],
    get loading() { return mockQuotasLoading },
    hasCachedQuotas: true,
    selectCredential: mockSelectCredential,
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
    mockQuotasLoading = false
    mockIsStaff.value = false
    credState.isResolved = false
    credState.usable = []
    credState.unverified = []
    credState.failing = []
    credsAfterFetch = []
    mockQuotaCredentialId.value = null

    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 5, 7, 14, 0, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('students: loads the stats, but no OpenStack credentials or quotas', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(mockFetchStats).toHaveBeenCalledTimes(1)
    expect(mockFetchCredentials).not.toHaveBeenCalled()
    expect(mockFetchQuotas).not.toHaveBeenCalled()
    expect(wrapper.text()).not.toContain('DashboardView.availableResources')
  })

  it('staff: loads the credentials and shows the quota of the first usable project', async () => {
    mockIsStaff.value = true
    credsAfterFetch = [cred('c-1', 'Project One')]

    const wrapper = mountView()
    await flushPromises()

    expect(mockFetchCredentials).toHaveBeenCalledTimes(1)
    expect(mockSelectCredential).toHaveBeenCalledWith('c-1')
    expect(mockFetchQuotas).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Project One')
  })

  it('does not re-fetch credentials that are already loaded', async () => {
    mockIsStaff.value = true
    credState.isResolved = true
    credState.usable = [cred('c-1', 'Project One')]

    mountView()
    await flushPromises()

    expect(mockFetchCredentials).not.toHaveBeenCalled()
    expect(mockSelectCredential).toHaveBeenCalledWith('c-1')
  })

  it('keeps the chosen project while it is still usable', async () => {
    mockIsStaff.value = true
    credState.isResolved = true
    credState.usable = [cred('c-1', 'Project One'), cred('c-2', 'Project Two')]
    mockQuotaCredentialId.value = 'c-2'

    mountView()
    await flushPromises()

    expect(mockSelectCredential).not.toHaveBeenCalled()
    expect(mockFetchQuotas).toHaveBeenCalledTimes(1)
  })

  it('with several usable projects a picker switches the quota shown', async () => {
    mockIsStaff.value = true
    credState.isResolved = true
    credState.usable = [cred('c-1', 'Project One'), cred('c-2', 'Project Two')]

    const wrapper = mountView()
    await flushPromises()
    mockSelectCredential.mockClear()
    mockFetchQuotas.mockClear()

    await wrapper.find('[data-testid="quota-credential"]').setValue('c-2')

    expect(mockSelectCredential).toHaveBeenCalledWith('c-2')
    expect(mockFetchQuotas).toHaveBeenCalledTimes(1)
  })

  it('moves the quota to another project when the shown one stops being usable', async () => {
    mockIsStaff.value = true
    credState.isResolved = true
    credState.usable = [cred('c-1', 'Project One'), cred('c-2', 'Project Two')]

    mountView()
    await flushPromises()
    expect(mockSelectCredential).toHaveBeenCalledWith('c-1')
    mockSelectCredential.mockClear()

    credState.usable = [cred('c-2', 'Project Two')]
    await flushPromises()

    expect(mockSelectCredential).toHaveBeenCalledWith('c-2')
  })

  it('without a usable credential it explains that only VM apps need one', async () => {
    mockIsStaff.value = true
    credsAfterFetch = []

    const wrapper = mountView()
    await flushPromises()

    expect(mockSelectCredential).toHaveBeenCalledWith(null)
    expect(wrapper.text()).toContain('DashboardView.noCredentialsTitle')
    // Not having a credential is fine (pods need none): no warning banner.
    expect(wrapper.findComponent(CredentialMissingBanner).exists()).toBe(false)
  })

  it('warns staff about credentials whose project is not verified yet', () => {
    mockIsStaff.value = true
    credState.isResolved = true
    credState.unverified = [{ ...cred('c-9', ''), project_verified: false }]

    const banner = mountView().findComponent(CredentialMissingBanner)

    expect(banner.exists()).toBe(true)
    expect(banner.props('variant')).toBe('warning')
  })

  it('reports a credential Keystone rejected', () => {
    mockIsStaff.value = true
    credState.isResolved = true
    credState.failing = [{ ...cred('c-3', 'Project Three'), last_validation_error: 'invalid_credentials' }]

    const banner = mountView().findComponent(CredentialMissingBanner)

    expect(banner.props('variant')).toBe('error')
    expect(banner.props('message')).toBe('invalid_credentials')
  })

  it('students never see credential banners', () => {
    credState.isResolved = true
    credState.unverified = [{ ...cred('c-9', ''), project_verified: false }]

    expect(mountView().findComponent(CredentialMissingBanner).exists()).toBe(false)
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
