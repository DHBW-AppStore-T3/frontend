import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/api/app.api', () => ({ appApi: { getVariables: vi.fn() } }))
vi.mock('@/components/OpenStackResourcePicker', () => ({
  default: (props: any) => <div data-testid={`picker-${props.osType}`} data-value={String(props.value ?? '')} />,
}))
vi.mock('@/composables/useOpenStackResourceCache', async (orig) => {
  const mod = await orig<typeof import('@/composables/useOpenStackResourceCache')>()
  return { ...mod, ensureLoaded: vi.fn(() => Promise.resolve()) }
})

import { appApi } from '@/api/app.api'
import NewDeploymentVariableView from '@/views/NewDeploymentVariableView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderView = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/deployment/new/variables" element={<NewDeploymentVariableView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/deployment/new/variables' },
  )

const variable = (over: Record<string, unknown>) => ({ type: 'string', source: 'terraform', ...over })
const draft = () => useDeploymentStore.getState().draft
const toastTypes = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])

function mockDefinitions(defs: unknown[]) {
  vi.mocked(appApi.getVariables).mockResolvedValue({ data: defs } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  const store = useDeploymentStore.getState()
  store.resetDraft()
  store.studentCache.clear()
  store.updateDraft({
    appId: 'app-1',
    name: 'Lab',
    releaseTag: 'v1',
    groupNames: ['Alpha', 'Beta'],
    assignments: [['u1'], ['u2']],
  })
  store.studentCache.set('u1', { username: 'ann' } as any)
  store.studentCache.set('u2', { username: 'bob' } as any)
  mockDefinitions([
    variable({ name: 'region', source: 'packer', default: 'eu' }),
    variable({ name: 'cpu', type: 'number', default: 2 }),
  ])
})

describe('NewDeploymentVariableView', () => {
  it('leitet zu /apps um, wenn keine App im Draft ist', async () => {
    useDeploymentStore.getState().updateDraft({ appId: null })
    renderView()
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/apps'))
  })

  it('lädt Variablen und gruppiert sie in Packer- und Terraform-Bereich', async () => {
    renderView()

    expect(await screen.findByText('region')).toBeInTheDocument()
    expect(screen.getByText('cpu')).toBeInTheDocument()
    expect(appApi.getVariables).toHaveBeenCalledWith('app-1', 'v1')
    expect(draft().variableDefinitions).toHaveLength(2)
    expect((screen.getByLabelText('region') as HTMLInputElement).value).toBe('eu')
    expect((screen.getByLabelText('cpu') as HTMLInputElement).value).toBe('2')
  })

  it('zeigt einen Hinweis, wenn der Ladevorgang fehlschlägt', async () => {
    vi.mocked(appApi.getVariables).mockRejectedValue(new Error('x'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderView()

    await waitFor(() => expect(toastTypes()).toContainEqual(['error', 'deployment.summary.fetchVarsError']))
    expect(screen.getByText('deployment.variables.noVariables')).toBeInTheDocument()
  })

  it('sperrt "Weiter" solange ein Pflichtfeld leer ist (Required-Gating)', async () => {
    mockDefinitions([variable({ name: 'token', required: true })])
    renderView()
    await screen.findByLabelText('token')

    expect(screen.getByRole('button', { name: /deployment\.actions\.next/ })).toBeDisabled()
    expect(screen.getByText('deployment.variables.missingRequiredTitle')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('token'), 'abc')

    expect(screen.getByRole('button', { name: /deployment\.actions\.next/ })).toBeEnabled()
  })

  it('speichert nur geänderte Werte als userInputVar und alle Werte in variables', async () => {
    renderView()
    await screen.findByText('cpu')

    fireEvent.change(screen.getByLabelText('cpu'), { target: { value: '8' } })
    await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.next/ }))

    expect(JSON.parse(draft().userInputVar as any)).toEqual({ cpu: 8 })
    expect(draft().variables).toEqual({ region: 'eu', cpu: 8 })
    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/summary')
  })

  it('geht über "Zurück" zur Team-Zuweisung', async () => {
    renderView()
    await screen.findByText('cpu')

    await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.back/ }))

    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/teams')
  })

  it('stellt Werte aus dem Draft wieder her, wenn Definitionen bereits geladen sind', async () => {
    useDeploymentStore.getState().updateDraft({
      variableDefinitions: [variable({ name: 'cpu', type: 'number', default: 2 })] as any,
      variables: { cpu: 16 },
    })
    renderView()

    await waitFor(() => expect((screen.getByLabelText('cpu') as HTMLInputElement).value).toBe('16'))
    expect(appApi.getVariables).not.toHaveBeenCalled()
  })

  describe('Expert-Variablen', () => {
    beforeEach(() => {
      mockDefinitions([
        variable({ name: 'normal', default: 'n' }),
        variable({ name: 'tweak', description: 'only for pros @expert', default: 't' }),
        variable({ name: 'pk', source: 'packer', description: '@expert', default: 'p' }),
      ])
    })

    it('versteckt Expert-Variablen hinter dem Accordion und zeigt die Anzahl', async () => {
      renderView()
      await screen.findByText('normal')

      expect(screen.queryByText('tweak')).not.toBeInTheDocument()
      expect(screen.queryByText('pk')).not.toBeInTheDocument()
      expect(screen.getAllByText('deployment.variables.expertSettings')).toHaveLength(2)
    })

    it('zeigt sie nach dem Aufklappen und entfernt @expert aus dem Tooltip', async () => {
      renderView()
      await screen.findByText('normal')

      await userEvent.click(screen.getAllByText('deployment.variables.expertSettings')[1]!)
      expect(await screen.findByText('tweak')).toBeInTheDocument()

      await userEvent.click(screen.getByTitle('deployment.variables.showInfo'))
      expect(screen.getByText('only for pros')).toBeInTheDocument()
    })

    it('klappt auf, wenn eine Pflicht-Expert-Variable keinen Default hat', async () => {
      mockDefinitions([variable({ name: 'must', description: '@expert', required: true })])
      renderView()

      expect(await screen.findByLabelText('must')).toBeInTheDocument()
    })
  })

  describe('Scopes', () => {
    it('zeigt pro Team ein Eingabefeld für team-scoped Variablen und verteilt den Default', async () => {
      mockDefinitions([variable({ name: 'size', varScope: 'team', default: 'S' })])
      renderView()
      await screen.findByText('size')

      expect((screen.getByLabelText('Team „Alpha"') as HTMLInputElement).value).toBe('S')
      expect((screen.getByLabelText('Team „Beta"') as HTMLInputElement).value).toBe('S')

      await userEvent.clear(screen.getByLabelText('Team „Beta"'))
      await userEvent.type(screen.getByLabelText('Team „Beta"'), 'L')
      await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.next/ }))

      expect(draft().variables).toEqual({ size: { Alpha: 'S', Beta: 'L' } })
    })

    it('zeigt pro Teammitglied ein Feld für user-scoped Variablen', async () => {
      mockDefinitions([variable({ name: 'pw', varScope: 'user' })])
      renderView()
      await screen.findByText('pw')

      expect(screen.getByLabelText('ann')).toBeInTheDocument()
      expect(screen.getByLabelText('bob')).toBeInTheDocument()
    })

    it('weist darauf hin, wenn keine Teams konfiguriert sind', async () => {
      useDeploymentStore.getState().updateDraft({ groupNames: [], assignments: [] })
      mockDefinitions([variable({ name: 'size', varScope: 'team' })])
      renderView()

      expect(await screen.findByText('deployment.variables.noTeamsConfigured')).toBeInTheDocument()
    })
  })

  describe('Datei-Variablen', () => {
    it('rendert pro Team eine Drop-Zone und speichert Uploads im Draft', async () => {
      mockDefinitions([variable({ name: 'task', osType: 'file', osScope: 'team', fileExtensions: ['pdf'] })])
      renderView()
      await screen.findByText('task')

      const inputs = document.querySelectorAll<HTMLInputElement>('input[type="file"]')
      expect(inputs).toHaveLength(2)
      expect(inputs[0]).toHaveAttribute('accept', '.pdf')

      const file = new File(['hello'], 'a.pdf', { type: 'application/pdf' })
      fireEvent.change(inputs[0]!, { target: { files: [file] } })

      await waitFor(() => expect(draft().fileUploads?.task?.Alpha?.name).toBe('a.pdf'))
    })
  })

  describe('Marker-Fehler', () => {
    it('zeigt sie an der Variable und als Toast', async () => {
      mockDefinitions([
        variable({ name: 'vm', markerError: { variable: 'vm', message: 'unknown marker', location: 'main.tf:3' } }),
      ])
      renderView()

      expect(await screen.findByText('unknown marker')).toBeInTheDocument()
      expect(screen.getByText('main.tf:3')).toBeInTheDocument()
      await waitFor(() =>
        expect(useToastStore.getState().toasts.some((t) => t.message === 'deployment.variables.markerErrorToast')).toBe(true),
      )
    })
  })

  it('übergibt OpenStack-Variablen an den Picker', async () => {
    mockDefinitions([variable({ name: 'flavor', osType: 'flavor', osMode: 'id' })])
    renderView()
    expect(await screen.findByTestId('picker-flavor')).toBeInTheDocument()
  })
})
