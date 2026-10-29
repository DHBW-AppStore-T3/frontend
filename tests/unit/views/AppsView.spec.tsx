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

// Teachers and admins register apps; students browse.
const asUser = (role = 'teacher', userId = 'me') =>
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

  it('rendert keinen Eyebrow über der Überschrift', async () => {
    vi.mocked(appApi.list).mockResolvedValue({ data: [] } as any)
    const { container } = renderView()
    await screen.findByText('AppsView.noAppsDesc')
    expect(container.querySelector('.page-eyebrow')).toBeNull()
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

describe('AppsView – Fachbereichsfilter', () => {
  const org = 'https://github.com/DHBW-AppStore'
  const jupyter = { appId: '1', name: 'Jupyter-Notebook', userId: 'x', git_link: `${org}/Jupyter-Notebook.git` }
  const latex = { appId: '2', name: 'Web-LaTeX', userId: 'x', git_link: `${org}/Web-LaTeX.git` }
  const ide = { appId: '3', name: 'Online-IDE', userId: 'x', git_link: `${org}/Online-IDE.git` }
  const unknown = { appId: '4', name: 'Fremde App', userId: 'x', git_link: 'https://github.com/fremd/web-latex.git' }
  const noLink = { appId: '5', name: 'Ohne Link', userId: 'x', git_link: null }

  const tab = (key: string) => screen.getByRole('button', { name: new RegExp(`workspace\\.categories\\.${key}`) })

  const loadApps = async (apps: { name: string }[]) => {
    vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
    renderView()
    await screen.findByText(apps[0]!.name)
  }

  it('zeigt Alle, die fünf Fachbereiche und Favoriten – und keine alten Kategorien', async () => {
    await loadApps([jupyter])

    for (const key of ['all', 'maschinenbau', 'informatik', 'elektrotechnik', 'wirtschaftsingenieurwesen', 'faecheruebergreifend', 'favorites']) {
      expect(tab(key)).toBeInTheDocument()
    }
    for (const key of ['productivity', 'development', 'data', 'other']) {
      expect(screen.queryByRole('button', { name: new RegExp(`workspace\\.categories\\.${key}`) })).not.toBeInTheDocument()
    }
  })

  it('zeigt unter Maschinenbau nur ausdrücklich zugeordnete Apps', async () => {
    await loadApps([jupyter, latex, ide, unknown, noLink])

    await userEvent.click(tab('maschinenbau'))

    expect(screen.getByText('Jupyter-Notebook')).toBeInTheDocument()
    expect(screen.getByText('Web-LaTeX')).toBeInTheDocument()
    expect(screen.queryByText('Online-IDE')).not.toBeInTheDocument()
    expect(screen.queryByText('Fremde App')).not.toBeInTheDocument()
    expect(screen.queryByText('Ohne Link')).not.toBeInTheDocument()
  })

  it('hält nicht zugeordnete Apps unter Alle sichtbar, aber aus jedem Fachbereich heraus', async () => {
    await loadApps([ide, unknown, noLink])

    expect(screen.getByText('Fremde App')).toBeInTheDocument()
    expect(screen.getByText('Ohne Link')).toBeInTheDocument()

    for (const key of ['maschinenbau', 'informatik', 'elektrotechnik', 'wirtschaftsingenieurwesen', 'faecheruebergreifend']) {
      await userEvent.click(tab(key))
      expect(screen.queryByText('Fremde App')).not.toBeInTheDocument()
      expect(screen.queryByText('Ohne Link')).not.toBeInTheDocument()
    }
  })

  it('schließt unter Fächerübergreifend keine reinen Informatik-Apps ein', async () => {
    await loadApps([jupyter, ide])

    await userEvent.click(tab('faecheruebergreifend'))

    expect(screen.getByText('Jupyter-Notebook')).toBeInTheDocument()
    expect(screen.queryByText('Online-IDE')).not.toBeInTheDocument()
  })

  it('zeigt die Anzahl pro Tab', async () => {
    await loadApps([jupyter, latex, ide, unknown])

    expect(tab('all')).toHaveTextContent('4')
    expect(tab('maschinenbau')).toHaveTextContent('2')
    expect(tab('informatik')).toHaveTextContent('3')
    expect(tab('wirtschaftsingenieurwesen')).toHaveTextContent('1')
  })

  it('zeigt für einen leeren Fachbereich einen Empty State ohne "App hinzufügen"', async () => {
    await loadApps([ide])

    await userEvent.click(tab('maschinenbau'))

    expect(screen.getByText('AppsView.noAppsInDepartment')).toBeInTheDocument()
    expect(screen.queryByText('Online-IDE')).not.toBeInTheDocument()
    // Only the permanent link in the page header remains; the empty-state action is omitted.
    expect(screen.getAllByRole('link', { name: 'AppsView.addApp' })).toHaveLength(1)
  })

  it('kombiniert Fachbereich und Suche per UND', async () => {
    await loadApps([jupyter, latex])

    await userEvent.click(tab('maschinenbau'))
    await userEvent.type(screen.getByRole('searchbox'), 'latex')

    expect(screen.getByText('Web-LaTeX')).toBeInTheDocument()
    expect(screen.queryByText('Jupyter-Notebook')).not.toBeInTheDocument()
  })

  it('markiert immer genau einen Tab als aktiv', async () => {
    await loadApps([jupyter])

    await userEvent.click(tab('informatik'))

    expect(screen.getAllByRole('button', { pressed: true, name: /workspace\.categories\./ })).toHaveLength(1)
    expect(tab('informatik')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('AppsView — wer Apps anlegen darf', () => {
  it('Studierende sehen keinen "App hinzufügen"-Button, auch nicht in der leeren Liste', async () => {
    asUser('student')
    vi.mocked(appApi.list).mockResolvedValue({ data: [] } as any)
    renderView()

    await screen.findByText('AppsView.title')
    await waitFor(() => expect(appApi.list).toHaveBeenCalled())
    expect(screen.queryByText('AppsView.addApp')).not.toBeInTheDocument()
  })

  describe('Filter „Empfohlen"', () => {
    const apps = [
      { appId: '1', name: 'Empfohlene App', description: 'a', userId: 'x', recommended: true },
      { appId: '2', name: 'Andere App', description: 'b', userId: 'x', recommended: false },
    ]
    const tabNames = () =>
      screen.getAllByRole('button', { pressed: undefined }).filter((b) => b.className.includes('catalog-tab'))

    it('zeigt Empfohlen als ersten Tab vor Alle', async () => {
      vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
      renderView()
      await screen.findByText('Empfohlene App')
      const labels = tabNames().map((b) => b.textContent)
      expect(labels[0]).toContain('workspace.categories.recommended')
      expect(labels[1]).toContain('workspace.categories.all')
    })

    it('wählt Empfohlen vor, wenn Apps empfohlen sind, und zeigt nur diese', async () => {
      vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
      renderView()
      expect(await screen.findByText('Empfohlene App')).toBeInTheDocument()
      expect(screen.queryByText('Andere App')).not.toBeInTheDocument()
      expect(tabNames()[0]).toHaveAttribute('aria-pressed', 'true')
    })

    it('blendet den Tab aus und wählt Alle, wenn keine App empfohlen ist', async () => {
      vi.mocked(appApi.list).mockResolvedValue({
        data: apps.map((a) => ({ ...a, recommended: false })),
      } as any)
      renderView()
      expect(await screen.findByText('Andere App')).toBeInTheDocument()
      expect(screen.getByText('Empfohlene App')).toBeInTheDocument()
      expect(screen.queryByText(/workspace\.categories\.recommended/)).not.toBeInTheDocument()
      expect(tabNames()[0].textContent).toContain('workspace.categories.all')
      expect(tabNames()[0]).toHaveAttribute('aria-pressed', 'true')
    })

    it('behält die Nutzerauswahl', async () => {
      vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
      renderView()
      await screen.findByText('Empfohlene App')
      await userEvent.click(screen.getByRole('button', { name: /workspace\.categories\.all/ }))
      expect(screen.getByText('Andere App')).toBeInTheDocument()
      expect(screen.getByText('Empfohlene App')).toBeInTheDocument()
    })

    it('zeigt den Leerzustand noRecommendedApps, wenn die Suche nichts findet', async () => {
      vi.mocked(appApi.list).mockResolvedValue({ data: apps } as any)
      renderView()
      await screen.findByText('Empfohlene App')
      await userEvent.type(screen.getByRole('searchbox'), 'zzz-kein-treffer')
      expect(screen.getByText('AppsView.noRecommendedApps')).toBeInTheDocument()
    })
  })
})
