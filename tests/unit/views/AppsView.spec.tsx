import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/app.api', () => ({
  appApi: { list: vi.fn(), listVersionApprovals: vi.fn() },
}))

import { appApi } from '@/api/app.api'
import AppsView from '@/views/AppsView'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  const l = useLocation()
  return <div data-testid="where">{l.pathname + l.hash}</div>
}

const renderView = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/apps" element={<AppsView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/apps' },
  )

const asUser = (role = 'student', userId = 'me') =>
  useAuthStore.setState({ user: { userId, role } as any })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useToastStore.setState({ toasts: [] })
  asUser()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: [] } as any)
})

describe('AppsView', () => {
  it('zeigt den Empty State, wenn die API ein leeres Array zurückgibt', async () => {
    vi.mocked(appApi.list).mockResolvedValue({ data: [] } as any)
    renderView()
    expect(await screen.findByText('AppsView.noAppsDesc')).toBeInTheDocument()
  })

  it('zeigt eine Liste von Apps an, wenn die API Daten liefert', async () => {
    vi.mocked(appApi.list).mockResolvedValue({
      data: [
        { appId: '1', name: 'Meine erste Vue App', description: 'Frontend', userId: 'x' },
        { appId: '2', name: 'NodeJS Backend', description: 'API', userId: 'x' },
      ],
    } as any)
    renderView()

    expect(await screen.findByText('Meine erste Vue App')).toBeInTheDocument()
    expect(screen.getByText('NodeJS Backend')).toBeInTheDocument()
  })

  it('zeigt eine Fehlermeldung (Toast) an, wenn der API-Aufruf fehlschlägt', async () => {
    vi.mocked(appApi.list).mockRejectedValue(new Error('Netzwerkfehler'))
    renderView()

    await waitFor(() =>
      expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['AppsView.loadError']),
    )
  })

  it('navigiert zur Detailseite bzw. zu den Deployment-Optionen', async () => {
    vi.mocked(appApi.list).mockResolvedValue({ data: [{ appId: 'app-999', name: 'Test App', userId: 'x' }] } as any)
    renderView()
    await screen.findByText('Test App')

    await userEvent.click(screen.getByRole('button', { name: 'workspace.details' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/apps/app-999')
  })

  it('"Deploy" springt zu #deployment-options', async () => {
    vi.mocked(appApi.list).mockResolvedValue({ data: [{ appId: 'app-9', name: 'Test App', userId: 'x' }] } as any)
    renderView()
    await screen.findByText('Test App')

    await userEvent.click(screen.getByRole('button', { name: 'workspace.deploy' }))
    expect(screen.getByTestId('where')).toHaveTextContent('/apps/app-9#deployment-options')
  })

  it('verwendet die richtigen Übersetzungs-Keys für statische Texte', async () => {
    vi.mocked(appApi.list).mockResolvedValue({ data: [] } as any)
    renderView()
    await screen.findByText('AppsView.noAppsDesc')

    expect(screen.getByText('AppsView.title')).toBeInTheDocument()
    expect(screen.getByText('AppsView.subtitle')).toBeInTheDocument()
    expect(screen.getAllByText('AppsView.addApp').length).toBeGreaterThan(0)
  })

  it('der "Hinzufügen" Button verweist auf /apps/create', async () => {
    vi.mocked(appApi.list).mockResolvedValue({ data: [] } as any)
    renderView()
    await screen.findByText('AppsView.noAppsDesc')

    expect(screen.getAllByRole('link', { name: 'AppsView.addApp' })[0]).toHaveAttribute('href', '/apps/create')
  })

  it('zeigt ein eigenes Bild anstelle des Katalog-Icons', async () => {
    vi.mocked(appApi.list).mockResolvedValue({
      data: [{ appId: 'c', name: 'App mit Logo', image: 'https://mein-server.de/logo.png', userId: 'x' }],
    } as any)
    renderView()

    const img = await screen.findByRole('img', { name: 'App mit Logo' })
    expect(img).toHaveAttribute('src', 'https://mein-server.de/logo.png')
  })

  it('zeigt einen Lade-Text, während die Daten geladen werden', () => {
    vi.mocked(appApi.list).mockReturnValue(new Promise(() => {}))
    renderView()
    expect(screen.getByText('AppsView.loading')).toBeInTheDocument()
  })

  it('filtert nach Suchbegriff und Kategorie', async () => {
    vi.mocked(appApi.list).mockResolvedValue({
      data: [
        { appId: '1', name: 'JupyterLab', userId: 'x' },
        { appId: '2', name: 'GitLab', userId: 'x' },
      ],
    } as any)
    renderView()
    await screen.findByText('JupyterLab')

    await userEvent.type(screen.getByRole('searchbox'), 'git')
    expect(screen.queryByText('JupyterLab')).not.toBeInTheDocument()
    expect(screen.getByText('GitLab')).toBeInTheDocument()
  })

  it('markiert und filtert Favoriten', async () => {
    vi.mocked(appApi.list).mockResolvedValue({
      data: [
        { appId: '1', name: 'JupyterLab', userId: 'x' },
        { appId: '2', name: 'GitLab', userId: 'x' },
      ],
    } as any)
    renderView()
    await screen.findByText('JupyterLab')

    await userEvent.click(screen.getAllByRole('button', { pressed: false, name: /workspace\.favorite/ })[0]!)
    await userEvent.click(screen.getByRole('button', { name: /workspace\.categories\.favorites/ }))

    expect(screen.getAllByRole('link', { name: /Lab/ })).toHaveLength(1)
  })

  it('zeigt den Status-Badge nur für eigene Apps, abgeleitet aus den Freigaben', async () => {
    vi.mocked(appApi.list).mockResolvedValue({
      data: [
        { appId: '1', name: 'Own', userId: 'me', is_private: false },
        { appId: '2', name: 'Other', userId: 'x', is_private: false },
      ],
    } as any)
    vi.mocked(appApi.listVersionApprovals).mockResolvedValue({ data: [{ status: 'approved' }] } as any)
    renderView()
    await screen.findByText('Own')

    await waitFor(() => expect(screen.getByText('AppVersionStatusBadge.published')).toBeInTheDocument())
    expect(appApi.listVersionApprovals).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText(/AppVersionStatusBadge\./)).toHaveLength(1)
  })

  it('bietet den Sichtbarkeitsfilter nur Admins an', async () => {
    vi.mocked(appApi.list).mockResolvedValue({ data: [] } as any)
    const { unmount } = renderView()
    await screen.findByText('AppsView.noAppsDesc')
    expect(screen.queryByLabelText('workspace.filters')).not.toBeInTheDocument()
    unmount()

    asUser('admin')
    renderView()
    await userEvent.click(await screen.findByLabelText('workspace.filters'))
    expect(screen.getByText('AppsView.filterPrivate')).toBeInTheDocument()
  })
})
