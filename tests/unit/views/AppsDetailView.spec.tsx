// @vitest-environment jsdom
// The description/edit dialog render markdown through DOMPurify (needs a full DOM).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import { I18nextProvider } from 'react-i18next'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/app.api', () => ({
  appApi: {
    getById: vi.fn(),
    listVersionApprovals: vi.fn(),
    submitVersion: vi.fn(),
    withdrawVersion: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

import { appApi } from '@/api/app.api'
import AppsDetailView from '@/views/AppsDetailView'
import { useAuthStore } from '@/stores/auth.store'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { useToastStore } from '@/stores/toast.store'
import { keyEchoI18n } from '../../helpers/render'

const baseApp = (over: Record<string, unknown> = {}) => ({
  appId: 'app-123',
  name: 'Test App',
  description: 'Detail Beschreibung',
  userId: 'owner',
  git_link: 'https://github.com/x/y',
  is_private: false,
  created_at: '2026-01-01T00:00:00Z',
  user: { username: 'owner-name' },
  versions: ['v1.0', 'v2.0'],
  ...over,
})

function Where() {
  const l = useLocation()
  return <div data-testid="where">{l.pathname + l.hash}</div>
}

function renderView(entries = ['/apps/app-123']) {
  return render(
    <I18nextProvider i18n={keyEchoI18n()}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Routes>
          <Route path="/apps/:id" element={<AppsDetailView />} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])
const setUser = (userId: string, role = 'student') => useAuthStore.setState({ user: { userId, role } as any })
const tab = (key: string) => screen.getByRole('button', { name: new RegExp(`AppsDetailView\\.${key}`) })

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useDeploymentStore.getState().resetDraft()
  useOpenStackCredentialsStore.getState().reset()
  setUser('owner')
  vi.mocked(appApi.getById).mockResolvedValue({ data: baseApp() } as any)
  vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: [] } as any)
})

describe('AppsDetailView', () => {
  // --- loading & display ---
  it('lädt die App-Details anhand der ID aus der URL', async () => {
    renderView()

    expect(await screen.findByRole('heading', { name: 'Test App' })).toBeInTheDocument()
    expect(appApi.getById).toHaveBeenCalledWith('app-123', false)
    expect(screen.getByText('Detail Beschreibung')).toBeInTheDocument()
  })

  it('leitet zur Liste um und zeigt einen Fehler, wenn die App nicht gefunden wird', async () => {
    vi.mocked(appApi.getById).mockRejectedValue(new Error('Not found'))
    renderView()

    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/apps'))
    expect(toasts()).toContainEqual(['error', 'AppsDetailView.toasts.loadError'])
  })

  it('wählt automatisch die erste Version aus', async () => {
    renderView()
    await screen.findByRole('heading', { name: 'Test App' })

    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('v1.0')
  })

  it('zeigt Versionsdetails, wenn vorhanden', async () => {
    vi.mocked(appApi.getById).mockResolvedValue({
      data: baseApp({
        versions: [{ version: 'v1.0', name: 'First', commit_sha: 'abc123', prerelease: 'true' }],
      }),
    } as any)
    renderView()

    expect(await screen.findByText('First')).toBeInTheDocument()
    expect(screen.getByText('abc123')).toBeInTheDocument()
    expect(screen.getByText('AppsDetailView.yes')).toBeInTheDocument()
  })

  // --- deployment ---
  it('speichert die Auswahl im Deployment-Store und navigiert zur Config', async () => {
    renderView()
    await screen.findByRole('heading', { name: 'Test App' })

    await userEvent.selectOptions(screen.getByRole('combobox'), 'v2.0')
    await userEvent.click(screen.getByRole('button', { name: /AppsDetailView\.deployButton/ }))

    const draft = useDeploymentStore.getState().draft
    expect(draft.appId).toBe('app-123')
    expect(draft.releaseTag).toBe('v2.0')
    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/config')
  })

  it('deaktiviert den Deploy-Button ohne Versionen', async () => {
    vi.mocked(appApi.getById).mockResolvedValue({ data: baseApp({ versions: [] }) } as any)
    renderView()
    await screen.findByRole('heading', { name: 'Test App' })

    expect(screen.getByRole('button', { name: /AppsDetailView\.deployButton/ })).toBeDisabled()
  })

  it('deaktiviert Deploy und verweist auf die Einstellungen, wenn keine Credentials hinterlegt sind', async () => {
    useOpenStackCredentialsStore.setState({ credentials: [] })
    renderView()
    await screen.findByRole('heading', { name: 'Test App' })

    expect(screen.getByRole('button', { name: /AppsDetailView\.deployButton/ })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'AppsDetailView.missingCredsLink' })).toHaveAttribute(
      'href',
      '/user/openstack',
    )
  })

  // --- delete ---
  it('zeigt Löschen nur für Besitzer/Admin', async () => {
    setUser('someone-else')
    renderView()
    await screen.findByRole('heading', { name: 'Test App' })

    expect(screen.queryByText('AppsDetailView.deleteApp')).not.toBeInTheDocument()
    expect(screen.queryByText('AppsDetailView.tabStore')).not.toBeInTheDocument()
  })

  it('ein Admin darf fremde Apps verwalten', async () => {
    setUser('someone-else', 'admin')
    renderView()

    expect(await screen.findByText('AppsDetailView.deleteApp')).toBeInTheDocument()
  })

  it('löscht die App nach Bestätigung im Modal', async () => {
    vi.mocked(appApi.delete).mockResolvedValue({} as any)
    renderView()
    await userEvent.click(await screen.findByRole('button', { name: /AppsDetailView\.deleteApp/ }))

    const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
    expect(within(dialog).getByText('AppsDetailView.confirmDeleteTitle')).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'AppsDetailView.confirmButton' }))

    await waitFor(() => expect(appApi.delete).toHaveBeenCalledWith('app-123'))
    expect(toasts()).toContainEqual(['success', 'AppsDetailView.deleteSuccessToast'])
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/apps'))
  })

  it('zeigt den Backend-Grund, wenn das Löschen fehlschlägt', async () => {
    vi.mocked(appApi.delete).mockRejectedValue({ response: { data: { detail: { message: 'in use' } } } })
    renderView()
    await userEvent.click(await screen.findByRole('button', { name: /AppsDetailView\.deleteApp/ }))
    const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
    await userEvent.click(within(dialog).getByRole('button', { name: 'AppsDetailView.confirmButton' }))

    await waitFor(() =>
      expect(toasts()).toContainEqual(['error', 'AppsDetailView.deleteErrorToast: in use']),
    )
  })

  // --- navigation ---
  it('navigiert zurück, wenn der Zurück-Button geklickt wird', async () => {
    renderView(['/apps', '/apps/app-123'])
    await screen.findByRole('heading', { name: 'Test App' })

    await userEvent.click(screen.getByRole('button', { name: /AppsDetailView\.backToOverview/ }))

    expect(screen.getByTestId('where').textContent).toBe('/apps')
  })

  // --- store tab ---
  describe('store tab', () => {
    const openStore = async () => {
      renderView()
      await screen.findByRole('heading', { name: 'Test App' })
      await userEvent.click(tab('tabStore'))
    }

    it('zeigt den Hinweis, wenn noch keine Version eingereicht wurde', async () => {
      await openStore()
      expect(screen.getByText('AppsDetailView.bannerNoSubmission')).toBeInTheDocument()
    })

    it('reicht eine Version mit Notizen ein', async () => {
      vi.mocked(appApi.submitVersion).mockResolvedValue({} as any)
      await openStore()

      await userEvent.click(screen.getAllByRole('button', { name: /AppsDetailView\.submitButton/ })[0]!)
      await userEvent.type(screen.getByPlaceholderText('AppsDetailView.submitModal.notesPlaceholder'), ' hi ')
      await userEvent.click(screen.getByRole('button', { name: 'AppsDetailView.submitModal.submit' }))

      await waitFor(() => expect(appApi.submitVersion).toHaveBeenCalledWith('app-123', 'v1.0', undefined, 'hi'))
      expect(toasts()).toContainEqual(['success', 'AppsDetailView.toasts.submitSuccess'])
    })

    it('zeigt Marker-Fehler (422) im Dialog', async () => {
      vi.mocked(appApi.submitVersion).mockRejectedValue({
        response: {
          status: 422,
          data: { detail: { marker_errors: [{ variable: 'vm_count', code: 'bad', message: 'invalid marker' }] } },
        },
      })
      await openStore()

      await userEvent.click(screen.getAllByRole('button', { name: /AppsDetailView\.submitButton/ })[0]!)
      await userEvent.click(screen.getByRole('button', { name: 'AppsDetailView.submitModal.submit' }))

      expect(await screen.findByText('invalid marker')).toBeInTheDocument()
      expect(screen.getByText('vm_count')).toBeInTheDocument()
    })

    it('meldet Duplikate (409) als Warnung', async () => {
      vi.mocked(appApi.submitVersion).mockRejectedValue({ response: { status: 409 } })
      await openStore()

      await userEvent.click(screen.getAllByRole('button', { name: /AppsDetailView\.submitButton/ })[0]!)
      await userEvent.click(screen.getByRole('button', { name: 'AppsDetailView.submitModal.submit' }))

      await waitFor(() => expect(toasts()).toContainEqual(['warning', 'AppsDetailView.toasts.submitDuplicate']))
    })

    it('zieht eine ausstehende Version zurück', async () => {
      vi.mocked(appApi.listVersionApprovals).mockResolvedValue({
        data: [{ approvalId: 'a', version_tag: 'v1.0', status: 'pending', created_at: '2026-01-01' }],
      } as any)
      vi.mocked(appApi.withdrawVersion).mockResolvedValue({} as any)
      await openStore()

      expect(screen.getByText('AppsDetailView.bannerPending')).toBeInTheDocument()
      await userEvent.click(await screen.findByRole('button', { name: /AppsDetailView\.withdrawButton/ }))

      await waitFor(() => expect(appApi.withdrawVersion).toHaveBeenCalledWith('app-123', 'v1.0'))
    })

    it('zeigt den Ablehnungsgrund und erlaubt erneutes Einreichen', async () => {
      vi.mocked(appApi.listVersionApprovals).mockResolvedValue({
        data: [
          { approvalId: 'a', version_tag: 'v1.0', status: 'rejected', rejection_reason: 'too big', created_at: '2026-01-01' },
        ],
      } as any)
      await openStore()

      expect(await screen.findByText(/too big/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /AppsDetailView\.resubmitButton/ })).toBeInTheDocument()
    })

    it('schaltet die Sichtbarkeit um', async () => {
      vi.mocked(appApi.update).mockResolvedValue({ data: {} } as any)
      await openStore()

      await userEvent.click(screen.getByRole('switch'))

      await waitFor(() => expect(appApi.update).toHaveBeenCalledWith('app-123', { is_private: true }))
      expect(toasts()).toContainEqual(['success', 'AppsDetailView.toasts.setPrivate'])
      expect(await screen.findByText('AppsDetailView.privateAppStoreHint')).toBeInTheDocument()
    })
  })

  // --- edit ---
  describe('edit modal', () => {
    const openEdit = async () => {
      renderView()
      await userEvent.click(await screen.findByRole('button', { name: /AppsDetailView\.editApp/ }))
      return document.querySelector('.fixed.inset-0') as HTMLElement
    }

    it('sendet nur geänderte Felder', async () => {
      vi.mocked(appApi.update).mockResolvedValue({ data: { name: 'Renamed' } } as any)
      const dialog = await openEdit()

      const name = within(dialog).getAllByRole('textbox')[0]!
      await userEvent.clear(name)
      await userEvent.type(name, 'Renamed')
      await userEvent.click(within(dialog).getByRole('button', { name: 'AppsDetailView.editModal.saveButton' }))

      await waitFor(() => expect(appApi.update).toHaveBeenCalledWith('app-123', { name: 'Renamed' }))
      expect(toasts()).toContainEqual(['success', 'AppsDetailView.toasts.editSuccess'])
      expect(await screen.findByRole('heading', { name: 'Renamed' })).toBeInTheDocument()
    })

    it('schließt ohne Request, wenn nichts geändert wurde', async () => {
      const dialog = await openEdit()
      await userEvent.click(within(dialog).getByRole('button', { name: 'AppsDetailView.editModal.saveButton' }))

      expect(appApi.update).not.toHaveBeenCalled()
      await waitFor(() => expect(document.querySelector('.fixed.inset-0')).toBeNull())
    })

    it('verlangt einen Namen', async () => {
      const dialog = await openEdit()
      await userEvent.clear(within(dialog).getAllByRole('textbox')[0]!)
      await userEvent.click(within(dialog).getByRole('button', { name: 'AppsDetailView.editModal.saveButton' }))

      expect(toasts()).toContainEqual(['error', 'AppsDetailView.toasts.nameRequired'])
      expect(appApi.update).not.toHaveBeenCalled()
    })
  })
})
