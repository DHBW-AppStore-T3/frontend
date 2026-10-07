import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AdminAppsView from '@/views/AdminAppsView.vue'

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: mocks.toastSuccess, error: mocks.toastError }),
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

function mountView() {
  return mount(AdminAppsView, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { RouterLink: { props: ['to'], template: '<a><slot /></a>' } },
    },
  })
}

const apps = [
  { appId: 'app-1', name: 'App One', is_private: false },
  { appId: 'app-2', name: 'App Two', is_private: false },
  { appId: 'app-3', name: 'Private App', is_private: true },
]

function freshApprovalsApp1() {
  return [
    { approvalId: 'v-1', version_tag: '1.0.0', status: 'pending', created_at: '2026-01-01T00:00:00Z' },
    { approvalId: 'v-2', version_tag: '0.9.0', status: 'approved', created_at: '2025-12-01T00:00:00Z' },
  ]
}

beforeEach(async () => {
  vi.clearAllMocks()
  const { appApi } = await import('@/api/app.api')
  vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
  vi.mocked(appApi.admin.listPendingApprovals).mockResolvedValue({
    data: [{ appId: 'app-1', version_tag: '1.0.0', status: 'pending' }],
  } as any)
  vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: freshApprovalsApp1() } as any)
})

describe('AdminAppsView', () => {
  it('loads apps and pending approvals on mount', async () => {
    const wrapper = mountView()
    await flushPromises()

    const { appApi } = await import('@/api/app.api')
    expect(appApi.list).toHaveBeenCalled()
    expect(appApi.admin.listPendingApprovals).toHaveBeenCalled()
    expect(wrapper.text()).toContain('App One')
  })

  it('shows a toast and no crash when the initial load fails', async () => {
    const { appApi } = await import('@/api/app.api')
    vi.mocked(appApi.list).mockRejectedValueOnce(new Error('network error'))

    mountView()
    await flushPromises()

    expect(mocks.toastError).toHaveBeenCalledWith('AdminAppsView.loadError')
  })

  it('filters to only apps with submissions by default', async () => {
    const wrapper = mountView()
    await flushPromises()

    // app-1 has a pending submission, app-2/app-3 don't.
    expect(wrapper.text()).toContain('App One')
    expect(wrapper.text()).not.toContain('App Two')
  })

  it('shows all apps when the submissions-only filter is toggled off', async () => {
    const wrapper = mountView()
    await flushPromises()

    await wrapper.get('button.relative').trigger('click')

    expect(wrapper.text()).toContain('App One')
    expect(wrapper.text()).toContain('App Two')
    expect(wrapper.text()).toContain('Private App')
  })

  it('sorts apps with more pending submissions first', async () => {
    const { appApi } = await import('@/api/app.api')
    vi.mocked(appApi.admin.listPendingApprovals).mockResolvedValueOnce({
      data: [
        { appId: 'app-2', version_tag: '1.0.0', status: 'pending' },
        { appId: 'app-1', version_tag: '1.0.0', status: 'pending' },
        { appId: 'app-1', version_tag: '1.1.0', status: 'pending' },
      ],
    } as any)

    const wrapper = mountView()
    await flushPromises()

    const names = wrapper.findAll('.font-semibold.text-textHeading').map(el => el.text())
    expect(names[0]).toBe('App One')
    expect(names[1]).toBe('App Two')
  })

  it('expands an app row and lazily loads its version approvals', async () => {
    const wrapper = mountView()
    await flushPromises()
    const { appApi } = await import('@/api/app.api')

    await wrapper.get('button.w-full').trigger('click')
    await flushPromises()

    expect(appApi.listVersionApprovals).toHaveBeenCalledWith('app-1')
    expect(wrapper.text()).toContain('1.0.0')
    expect(wrapper.text()).toContain('0.9.0')
  })

  it('does not reload approvals when expanding the same app twice', async () => {
    const wrapper = mountView()
    await flushPromises()
    const { appApi } = await import('@/api/app.api')

    await wrapper.get('button.w-full').trigger('click')
    await flushPromises()
    await wrapper.get('button.w-full').trigger('click') // collapse
    await wrapper.get('button.w-full').trigger('click') // expand again
    await flushPromises()

    expect(appApi.listVersionApprovals).toHaveBeenCalledTimes(1)
  })

  it('shows a note instead of versions for a private app', async () => {
    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('button.relative').trigger('click') // show all apps

    const buttons = wrapper.findAll('button.w-full')
    const privateRow = buttons.find(b => b.text().includes('Private App'))!
    await privateRow.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('AdminAppsView.privateAppNote')
  })

  it('shows an empty message when the expanded app has no submitted versions', async () => {
    const { appApi } = await import('@/api/app.api')
    vi.mocked(appApi.listVersionApprovals).mockResolvedValueOnce({ data: [] } as any)

    const wrapper = mountView()
    await flushPromises()
    await wrapper.get('button.relative').trigger('click') // show all apps

    const buttons = wrapper.findAll('button.w-full')
    const row = buttons.find(b => b.text().includes('App Two'))!
    await row.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('AdminAppsView.noVersionsSubmitted')
  })

  describe('approve', () => {
    it('approves a pending version and updates local state', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.admin.approveVersion).mockResolvedValueOnce({} as any)

      const wrapper = mountView()
      await flushPromises()
      await wrapper.get('button.w-full').trigger('click')
      await flushPromises()

      const approveBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.approveBtn'))!
      await approveBtn.trigger('click')
      await flushPromises()

      expect(appApi.admin.approveVersion).toHaveBeenCalledWith('app-1', '1.0.0')
      expect(mocks.toastSuccess).toHaveBeenCalledWith('AdminAppsView.approveSuccess')

      // Local state must reflect the approval immediately, without waiting
      // for a refetch: the row's badge switches from pending to approved,
      // and the app-level pending count (shown on the collapsed header and
      // used for sorting) decrements.
      expect(wrapper.text()).not.toContain('AdminAppsView.pendingLabel')
      const approveButtons = wrapper.findAll('button').filter(b => b.text().includes('AdminAppsView.approveBtn'))
      expect(approveButtons).toHaveLength(0)
    })

    it('decrements the app-level pending badge after an approval', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.admin.approveVersion).mockResolvedValueOnce({} as any)
      vi.mocked(appApi.admin.listPendingApprovals).mockResolvedValueOnce({
        data: [
          { appId: 'app-1', version_tag: '1.0.0', status: 'pending' },
          { appId: 'app-1', version_tag: '1.1.0', status: 'pending' },
        ],
      } as any)
      vi.mocked(appApi.listVersionApprovals).mockResolvedValueOnce({
        data: [
          { approvalId: 'v-1', version_tag: '1.0.0', status: 'pending', created_at: '2026-01-01T00:00:00Z' },
          { approvalId: 'v-3', version_tag: '1.1.0', status: 'pending', created_at: '2026-01-02T00:00:00Z' },
        ],
      } as any)

      const wrapper = mountView()
      await flushPromises()

      // App row header shows "2 pending" before any action.
      expect(wrapper.text()).toContain('2')
      expect(wrapper.text()).toContain('AdminAppsView.pendingLabel')

      await wrapper.get('button.w-full').trigger('click')
      await flushPromises()

      const approveBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.approveBtn'))!
      await approveBtn.trigger('click')
      await flushPromises()

      // One of the two pending versions was approved — the header badge
      // must drop from 2 to 1, not stay stuck at the pre-approval count.
      const header = wrapper.find('button.w-full')
      expect(header.text()).toContain('1')
      expect(header.text()).not.toContain('2')
    })

    it('shows an error toast when approval fails', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.admin.approveVersion).mockRejectedValueOnce(new Error('boom'))

      const wrapper = mountView()
      await flushPromises()
      await wrapper.get('button.w-full').trigger('click')
      await flushPromises()

      const approveBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.approveBtn'))!
      await approveBtn.trigger('click')
      await flushPromises()

      expect(mocks.toastError).toHaveBeenCalledWith('AdminAppsView.approveError')
    })
  })

  describe('reject', () => {
    it('opens the reject modal and submits a reason', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.admin.rejectVersion).mockResolvedValueOnce({} as any)

      const wrapper = mountView()
      await flushPromises()
      await wrapper.get('button.w-full').trigger('click')
      await flushPromises()

      const rejectBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.rejectBtn'))!
      await rejectBtn.trigger('click')

      const textarea = wrapper.get('textarea')
      await textarea.setValue('does not meet guidelines')

      const submitBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.rejectModal.submit'))!
      await submitBtn.trigger('click')
      await flushPromises()

      expect(appApi.admin.rejectVersion).toHaveBeenCalledWith('app-1', '1.0.0', 'does not meet guidelines')
      expect(mocks.toastSuccess).toHaveBeenCalledWith('AdminAppsView.rejectSuccess')
    })

    it('disables the submit button while the reason is blank', async () => {
      const wrapper = mountView()
      await flushPromises()
      await wrapper.get('button.w-full').trigger('click')
      await flushPromises()

      const rejectBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.rejectBtn'))!
      await rejectBtn.trigger('click')

      const submitBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.rejectModal.submit'))!
      expect(submitBtn!.attributes('disabled')).toBeDefined()
    })

    it('shows an error toast when rejection fails', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.admin.rejectVersion).mockRejectedValueOnce(new Error('boom'))

      const wrapper = mountView()
      await flushPromises()
      await wrapper.get('button.w-full').trigger('click')
      await flushPromises()

      const rejectBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.rejectBtn'))!
      await rejectBtn.trigger('click')
      await wrapper.get('textarea').setValue('reason')

      const submitBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.rejectModal.submit'))!
      await submitBtn.trigger('click')
      await flushPromises()

      expect(mocks.toastError).toHaveBeenCalledWith('AdminAppsView.rejectError')
    })
  })

  describe('revoke', () => {
    it('opens the revoke modal and submits a reason for an approved version', async () => {
      const { appApi } = await import('@/api/app.api')
      vi.mocked(appApi.admin.revokeVersion).mockResolvedValueOnce({} as any)

      const wrapper = mountView()
      await flushPromises()
      await wrapper.get('button.w-full').trigger('click')
      await flushPromises()

      const revokeBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.revokeBtn'))!
      await revokeBtn.trigger('click')
      await wrapper.get('textarea').setValue('security concern')

      const submitBtn = wrapper.findAll('button').find(b => b.text().includes('AdminAppsView.revokeModal.submit'))!
      await submitBtn.trigger('click')
      await flushPromises()

      expect(appApi.admin.revokeVersion).toHaveBeenCalledWith('app-1', '0.9.0', 'security concern')
      expect(mocks.toastSuccess).toHaveBeenCalledWith('AdminAppsView.revokeSuccess')
    })
  })
})
