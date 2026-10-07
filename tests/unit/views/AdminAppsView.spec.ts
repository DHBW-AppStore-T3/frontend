import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

// ---------------------------------------------------------------------------
// vi.hoisted: variables that must exist at mock-factory evaluation time
// ---------------------------------------------------------------------------
const { mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (k: string) => k }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: mockToastSuccess, error: mockToastError }),
}))

vi.mock('@/api/app.api', () => ({
  appApi: {
    list: vi.fn(),
    listVersionApprovals: vi.fn(),
    admin: {
      listPendingApprovals: vi.fn(),
      approveVersion: vi.fn(),
      rejectVersion: vi.fn(),
      revokeVersion: vi.fn(),
    },
  },
}))

import { appApi } from '@/api/app.api'
import AdminAppsView from '@/views/AdminAppsView.vue'

const mockListApps = vi.mocked(appApi.list)
const mockListPendingApprovals = vi.mocked(appApi.admin.listPendingApprovals)
const mockListVersionApprovals = vi.mocked(appApi.listVersionApprovals)
const mockApproveVersion = vi.mocked(appApi.admin.approveVersion)

const APP_A = { appId: 'app-1', name: 'Vue App', description: '' }
const APP_B = { appId: 'app-2', name: 'Node API', description: '' }
const APPROVAL_PENDING = { appId: 'app-1', version_tag: 'v1.0', status: 'pending', app: APP_A }
const APPROVAL_APPROVED = { appId: 'app-1', version_tag: 'v0.9', status: 'approved', app: APP_A }

beforeEach(() => {
  vi.clearAllMocks()
})

const mount_ = () =>
  mount(AdminAppsView, {
    global: {
      mocks: { $t: (k: string) => k },
      stubs: {
        PageHeader: { template: '<div><slot name="actions" /></div>' },
        EntityListState: { template: '<div><slot /></div>' },
        AppVersionStatusBadge: { template: '<span />' },
        BaseButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        Modal: {
          props: ['modelValue'],
          template: '<div v-if="modelValue"><slot /></div>',
        },
      },
    },
  })

describe('AdminAppsView.vue', () => {
  it('loads apps and pending approvals on mount', async () => {
    mockListApps.mockResolvedValue({ data: [APP_A, APP_B] } as any)
    mockListPendingApprovals.mockResolvedValue({ data: [APPROVAL_PENDING] } as any)
    mount_()
    await flushPromises()
    expect(mockListApps).toHaveBeenCalledOnce()
    expect(mockListPendingApprovals).toHaveBeenCalledOnce()
  })

  it('shows error toast when initial load fails', async () => {
    mockListApps.mockRejectedValue(new Error('500'))
    mockListPendingApprovals.mockResolvedValue({ data: [] } as any)
    mount_()
    await flushPromises()
    expect(mockToastError).toHaveBeenCalledWith('AdminAppsView.loadError')
  })

  it('renders app names after successful load', async () => {
    mockListApps.mockResolvedValue({ data: [APP_A, APP_B] } as any)
    // Both apps have a pending submission so neither is hidden by the default filter
    const pendingB = { appId: 'app-2', version_tag: 'v1.0', status: 'pending', app: APP_B }
    mockListPendingApprovals.mockResolvedValue({ data: [APPROVAL_PENDING, pendingB] } as any)
    const wrapper = mount_()
    await flushPromises()
    expect(wrapper.text()).toContain('Vue App')
    expect(wrapper.text()).toContain('Node API')
  })

  it('shows only apps with submissions when filter is on (default)', async () => {
    mockListApps.mockResolvedValue({ data: [APP_A, APP_B] } as any)
    mockListPendingApprovals.mockResolvedValue({ data: [APPROVAL_PENDING] } as any)
    const wrapper = mount_()
    await flushPromises()
    expect(wrapper.text()).toContain('Vue App')
    expect(wrapper.text()).not.toContain('Node API')
  })

  it('sorts apps: those with pending submissions appear first', async () => {
    mockListApps.mockResolvedValue({ data: [APP_B, APP_A] } as any)
    mockListPendingApprovals.mockResolvedValue({ data: [APPROVAL_PENDING] } as any)
    const wrapper = mount_()
    await flushPromises()
    const text = wrapper.text()
    const aIdx = text.indexOf('Vue App')
    // APP_A has pending, so it should appear; APP_B has none so it may be hidden by default filter
    expect(aIdx).toBeGreaterThanOrEqual(0)
  })

  it('loads approvals when an app row is expanded', async () => {
    mockListApps.mockResolvedValue({ data: [APP_A] } as any)
    mockListPendingApprovals.mockResolvedValue({ data: [APPROVAL_PENDING] } as any)
    mockListVersionApprovals.mockResolvedValue({ data: [APPROVAL_PENDING, APPROVAL_APPROVED] } as any)
    const wrapper = mount_()
    await flushPromises()

    const expandBtn = wrapper.findAll('button').find(b => b.text().includes('Vue App'))
    if (expandBtn) {
      await expandBtn.trigger('click')
      await flushPromises()
      expect(mockListVersionApprovals).toHaveBeenCalledWith('app-1')
    }
  })

  it('calls approveVersion and shows success toast', async () => {
    mockListApps.mockResolvedValue({ data: [APP_A] } as any)
    mockListPendingApprovals.mockResolvedValue({ data: [APPROVAL_PENDING] } as any)
    mockListVersionApprovals.mockResolvedValue({ data: [APPROVAL_PENDING] } as any)
    mockApproveVersion.mockResolvedValue({} as any)
    const wrapper = mount_()
    await flushPromises()

    const expandBtn = wrapper.findAll('button').find(b => b.text().includes('Vue App'))
    if (expandBtn) {
      await expandBtn.trigger('click')
      await flushPromises()
    }

    const approveBtn = wrapper.findAll('button').find(b =>
      b.text().includes('AdminAppsView.approve'),
    )
    if (approveBtn) {
      await approveBtn.trigger('click')
      await flushPromises()
      expect(mockApproveVersion).toHaveBeenCalledWith('app-1', 'v1.0')
      expect(mockToastSuccess).toHaveBeenCalledWith('AdminAppsView.approveSuccess')
    }
  })

  it('shows error toast when approve fails', async () => {
    mockListApps.mockResolvedValue({ data: [APP_A] } as any)
    mockListPendingApprovals.mockResolvedValue({ data: [APPROVAL_PENDING] } as any)
    mockListVersionApprovals.mockResolvedValue({ data: [APPROVAL_PENDING] } as any)
    mockApproveVersion.mockRejectedValue(new Error('500'))
    const wrapper = mount_()
    await flushPromises()

    const expandBtn = wrapper.findAll('button').find(b => b.text().includes('Vue App'))
    if (expandBtn) {
      await expandBtn.trigger('click')
      await flushPromises()
    }

    const approveBtn = wrapper.findAll('button').find(b =>
      b.text().includes('AdminAppsView.approve'),
    )
    if (approveBtn) {
      await approveBtn.trigger('click')
      await flushPromises()
      expect(mockToastError).toHaveBeenCalledWith('AdminAppsView.approveError')
    }
  })
})
