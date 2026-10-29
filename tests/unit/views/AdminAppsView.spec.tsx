import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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
import AdminAppsView from '@/views/AdminAppsView'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../helpers/render'

const apps = [
  { appId: 'app-1', name: 'App One', is_private: false },
  { appId: 'app-2', name: 'App Two', is_private: false },
  { appId: 'app-3', name: 'Private App', is_private: true },
]

const approvalsApp1 = () => [
  { approvalId: 'v-1', version_tag: '1.0.0', status: 'pending', created_at: '2026-01-01T00:00:00Z' },
  { approvalId: 'v-2', version_tag: '0.9.0', status: 'approved', created_at: '2025-12-01T00:00:00Z' },
]

const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])
const renderView = () => renderWithProviders(<AdminAppsView />)
const headerOf = (name: string) => screen.getByRole('button', { name: new RegExp(name) })
const expand = async (name = 'App One') => {
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(name) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
  vi.mocked(appApi.admin.listPendingApprovals).mockResolvedValue({
    data: [{ appId: 'app-1', version_tag: '1.0.0', status: 'pending' }],
  } as any)
  vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: approvalsApp1() } as any)
})

describe('AdminAppsView', () => {
  it('names the submissions-only switch by its visible label (#141)', async () => {
    renderView()
    await screen.findByText('App One')
    expect(screen.getByRole('switch', { name: 'AdminAppsView.filterLabel' })).toHaveAttribute('aria-checked', 'true')
  })

  it('loads apps and pending approvals on mount', async () => {
    renderView()
    await screen.findByText('App One')
    expect(appApi.list).toHaveBeenCalledTimes(1)
    expect(appApi.admin.listPendingApprovals).toHaveBeenCalledTimes(1)
  })

  it('shows a toast and no crash when the initial load fails', async () => {
    vi.mocked(appApi.list).mockRejectedValue(new Error('down'))
    renderView()
    await waitFor(() => expect(toasts()).toContainEqual(['error', 'AdminAppsView.loadError']))
  })

  it('filters to only apps with submissions by default', async () => {
    renderView()
    await screen.findByText('App One')
    expect(screen.queryByText('App Two')).not.toBeInTheDocument()
    expect(screen.queryByText('Private App')).not.toBeInTheDocument()
  })

  it('shows all apps when the submissions-only filter is toggled off', async () => {
    renderView()
    await screen.findByText('App One')

    await userEvent.click(screen.getByRole('switch'))

    expect(screen.getByText('App Two')).toBeInTheDocument()
    expect(screen.getByText('Private App')).toBeInTheDocument()
  })

  it('sorts apps with more pending submissions first', async () => {
    vi.mocked(appApi.admin.listPendingApprovals).mockResolvedValue({
      data: [{ appId: 'app-2' }, { appId: 'app-2' }, { appId: 'app-1' }],
    } as any)
    renderView()
    await screen.findByText('App One')

    const names = screen.getAllByText(/^App (One|Two)$/).map((n) => n.textContent)
    expect(names).toEqual(['App Two', 'App One'])
  })

  it('shows the dedicated empty state with a way to show all apps', async () => {
    vi.mocked(appApi.admin.listPendingApprovals).mockResolvedValue({ data: [] } as any)
    renderView()

    await userEvent.click(await screen.findByText('AdminAppsView.emptyShowAll'))

    expect(screen.getByText('App One')).toBeInTheDocument()
  })

  it('expands an app row and lazily loads its version approvals', async () => {
    renderView()
    await expand()

    expect(await screen.findByText('1.0.0')).toBeInTheDocument()
    expect(appApi.listVersionApprovals).toHaveBeenCalledWith('app-1')
  })

  it('does not reload approvals when expanding the same app twice', async () => {
    renderView()
    await expand()
    await screen.findByText('1.0.0')

    await userEvent.click(headerOf('App One'))
    await userEvent.click(headerOf('App One'))

    expect(appApi.listVersionApprovals).toHaveBeenCalledTimes(1)
  })

  it('shows a note instead of versions for a private app', async () => {
    renderView()
    await screen.findByText('App One')
    await userEvent.click(screen.getByRole('switch')) // show all apps
    await expand('Private App')

    expect(await screen.findByText('AdminAppsView.privateAppNote')).toBeInTheDocument()
  })

  it('shows an empty message when the expanded app has no submitted versions', async () => {
    vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: [] } as any)
    renderView()
    await screen.findByText('App One')
    // With the filter on, an app without submissions drops out of the list as
    // soon as its (empty) history is known — show all apps first.
    await userEvent.click(screen.getByRole('switch'))
    await expand('App Two')

    expect(await screen.findByText('AdminAppsView.noVersionsSubmitted')).toBeInTheDocument()
  })

  describe('approve', () => {
    it('approves a pending version and updates local state', async () => {
      vi.mocked(appApi.admin.approveVersion).mockResolvedValue({} as any)
      renderView()
      await expand()
      await userEvent.click(await screen.findByRole('button', { name: /AdminAppsView\.approveBtn/ }))

      await waitFor(() => expect(appApi.admin.approveVersion).toHaveBeenCalledWith('app-1', '1.0.0'))
      expect(toasts()).toContainEqual(['success', 'AdminAppsView.approveSuccess'])
      // The pending badge and the approve button disappear without a refetch.
      expect(screen.queryByText(/AdminAppsView\.pendingLabel/)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /AdminAppsView\.approveBtn/ })).not.toBeInTheDocument()
    })

    it('decrements the app-level pending badge after an approval', async () => {
      vi.mocked(appApi.admin.approveVersion).mockResolvedValue({} as any)
      vi.mocked(appApi.admin.listPendingApprovals).mockResolvedValue({
        data: [{ appId: 'app-1' }, { appId: 'app-1' }],
      } as any)
      vi.mocked(appApi.listVersionApprovals).mockResolvedValue({
        data: [
          { approvalId: 'v-1', version_tag: '1.0.0', status: 'pending', created_at: '2026-01-01' },
          { approvalId: 'v-3', version_tag: '1.1.0', status: 'pending', created_at: '2026-01-02' },
        ],
      } as any)
      renderView()
      expect(await screen.findByText(/^2\s+AdminAppsView\.pendingLabel/)).toBeInTheDocument()

      await expand()
      await userEvent.click((await screen.findAllByRole('button', { name: /AdminAppsView\.approveBtn/ }))[0]!)

      expect(await screen.findByText(/^1\s+AdminAppsView\.pendingLabel/)).toBeInTheDocument()
    })

    it('shows an error toast when approval fails', async () => {
      vi.mocked(appApi.admin.approveVersion).mockRejectedValue(new Error('boom'))
      renderView()
      await expand()
      await userEvent.click(await screen.findByRole('button', { name: /AdminAppsView\.approveBtn/ }))

      await waitFor(() => expect(toasts()).toContainEqual(['error', 'AdminAppsView.approveError']))
    })
  })

  describe('reject', () => {
    const openRejectModal = async () => {
      await expand()
      await userEvent.click(await screen.findByRole('button', { name: /AdminAppsView\.rejectBtn/ }))
      return document.querySelector('.fixed.inset-0') as HTMLElement
    }

    it('opens the reject modal and submits a reason', async () => {
      vi.mocked(appApi.admin.rejectVersion).mockResolvedValue({} as any)
      renderView()
      const dialog = await openRejectModal()

      await userEvent.type(within(dialog).getByRole('textbox'), 'does not meet guidelines')
      await userEvent.click(within(dialog).getByRole('button', { name: 'AdminAppsView.rejectModal.submit' }))

      await waitFor(() =>
        expect(appApi.admin.rejectVersion).toHaveBeenCalledWith('app-1', '1.0.0', 'does not meet guidelines'),
      )
      expect(toasts()).toContainEqual(['success', 'AdminAppsView.rejectSuccess'])
      await waitFor(() => expect(document.querySelector('.fixed.inset-0')).toBeNull())
    })

    it('disables the submit button while the reason is blank', async () => {
      renderView()
      const dialog = await openRejectModal()

      expect(within(dialog).getByRole('button', { name: 'AdminAppsView.rejectModal.submit' })).toBeDisabled()
    })

    it('shows an error toast when rejection fails and keeps the modal open', async () => {
      vi.mocked(appApi.admin.rejectVersion).mockRejectedValue(new Error('boom'))
      renderView()
      const dialog = await openRejectModal()

      await userEvent.type(within(dialog).getByRole('textbox'), 'reason')
      await userEvent.click(within(dialog).getByRole('button', { name: 'AdminAppsView.rejectModal.submit' }))

      await waitFor(() => expect(toasts()).toContainEqual(['error', 'AdminAppsView.rejectError']))
      expect(document.querySelector('.fixed.inset-0')).not.toBeNull()
    })
  })

  describe('revoke', () => {
    it('opens the revoke modal and submits a reason for an approved version', async () => {
      vi.mocked(appApi.admin.revokeVersion).mockResolvedValue({} as any)
      renderView()
      await expand()
      await userEvent.click(await screen.findByRole('button', { name: /AdminAppsView\.revokeBtn/ }))
      const dialog = document.querySelector('.fixed.inset-0') as HTMLElement

      await userEvent.type(within(dialog).getByRole('textbox'), 'security concern')
      await userEvent.click(within(dialog).getByRole('button', { name: 'AdminAppsView.revokeModal.submit' }))

      await waitFor(() =>
        expect(appApi.admin.revokeVersion).toHaveBeenCalledWith('app-1', '0.9.0', 'security concern'),
      )
      expect(toasts()).toContainEqual(['success', 'AdminAppsView.revokeSuccess'])
    })
  })

  describe('was eine Freigabe festlegt', () => {
    const expandWith = async (approvals: unknown[]) => {
      vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: approvals } as any)
      renderView()
      await expand()
      return within(await screen.findByTestId('review-scope'))
    }

    it('zeigt bei einer Pod-Version Laufzeit, Commit, appstore.yaml-Hash und Image-Digests', async () => {
      const scope = await expandWith([
        {
          approvalId: 'v-1',
          version_tag: '1.0.0',
          status: 'pending',
          created_at: '2026-01-01T00:00:00Z',
          runtime: 'kubernetes',
          commit_sha: 'abcdef0123456789abcdef',
          spec_sha256: '0123456789abcdef0123',
          image_digests: ['sha256:aaaaaaaaaaaaaaaaaaaaaaaa', 'sha256:bbbbbbbbbbbbbbbbbbbbbbbb'],
        },
      ])

      expect(scope.getByText('runtime.kubernetes')).toBeInTheDocument()
      expect(scope.getByText('abcdef012345')).toBeInTheDocument()
      expect(scope.getByText('0123456789ab')).toBeInTheDocument()
      expect(scope.getAllByText(/^sha256:/)).toHaveLength(2)
    })

    it('weist eine Version ohne Commit darauf hin, dass sie neu eingereicht werden muss', async () => {
      const scope = await expandWith([
        { approvalId: 'v-1', version_tag: '1.0.0', status: 'pending', created_at: '2026-01-01T00:00:00Z', runtime: 'kubevirt-vm', commit_sha: null },
      ])

      expect(scope.getByText('AdminAppsView.notPinned')).toBeInTheDocument()
      expect(scope.queryByText('AdminAppsView.specLabel')).not.toBeInTheDocument()
    })
  })
})
