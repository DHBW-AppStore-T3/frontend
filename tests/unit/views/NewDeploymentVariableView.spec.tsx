import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/api/app.api', () => ({ appApi: { getVariables: vi.fn() } }))

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
    variable({ name: 'region', default: 'eu' }),
    variable({ name: 'cpu', type: 'number', default: 2 }),
  ])
})

describe('NewDeploymentVariableView', () => {
  it('leitet zu /apps um, wenn keine App im Draft ist', async () => {
    useDeploymentStore.getState().updateDraft({ appId: null })
    renderView()
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/apps'))
  })

  it('lädt Variablen und zeigt sie als App-Einstellungen', async () => {
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

  describe('Definitionen aus dem Draft (vorgeladen in Schritt 1)', () => {
    it('lädt eine geladene, leere Antwort nicht erneut und zeigt die Leer-Meldung sofort', () => {
      useDeploymentStore.getState().updateDraft({ variableDefinitions: [] })
      renderView()

      expect(screen.getByText('deployment.variables.noVariables')).toBeInTheDocument()
      expect(screen.queryByText('deployment.variables.loading')).not.toBeInTheDocument()
      expect(appApi.getVariables).not.toHaveBeenCalled()
    })

    it('wartet auf eine noch laufende Anfrage, statt eine zweite zu stellen', async () => {
      const { ensureVariableDefinitions } = await import('@/views/new-deployment/variableDefinitions')
      const prefetch = ensureVariableDefinitions()
      renderView()

      expect(await screen.findByLabelText('region')).toBeInTheDocument()
      await prefetch
      expect(appApi.getVariables).toHaveBeenCalledTimes(1)
    })

    it('startet beim ersten Besuch wie nach einem frischen Laden: ein Pflicht-Bool ohne Default ist aus', async () => {
      useDeploymentStore.getState().updateDraft({
        variableDefinitions: [variable({ name: 'agree', type: 'bool', required: true })] as any,
      })
      renderView()

      await screen.findByLabelText('agree')
      expect(screen.getByRole('button', { name: /deployment\.actions\.next/ })).toBeEnabled()
    })

    it('zeigt nach dem Zurückkehren die gespeicherten Werte statt der Defaults', async () => {
      useDeploymentStore.getState().updateDraft({
        variableDefinitions: [variable({ name: 'cpu', type: 'number', default: 2 })] as any,
        variables: { cpu: 16 },
        userInputVar: JSON.stringify({ cpu: 16 }),
      })
      renderView()

      await waitFor(() => expect((screen.getByLabelText('cpu') as HTMLInputElement).value).toBe('16'))
    })
  })

  describe('Expert-Variablen', () => {
    beforeEach(() => {
      mockDefinitions([
        variable({ name: 'normal', default: 'n' }),
        variable({ name: 'tweak', description: 'only for pros @expert', default: 't' }),
      ])
    })

    it('versteckt Expert-Variablen hinter dem Accordion und zeigt die Anzahl', async () => {
      renderView()
      await screen.findByText('normal')

      expect(screen.queryByText('tweak')).not.toBeInTheDocument()
      expect(screen.getAllByText('deployment.variables.expertSettings')).toHaveLength(1)
    })

    it('zeigt sie nach dem Aufklappen und entfernt @expert aus dem Tooltip', async () => {
      renderView()
      await screen.findByText('normal')

      await userEvent.click(screen.getAllByText('deployment.variables.expertSettings')[0]!)
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
    const fileVar = (over: Record<string, unknown> = {}) =>
      variable({ name: 'task', osType: 'file', osScope: 'team', varScope: 'team', fileExtensions: ['pdf'], ...over })
    const input = () => document.querySelector<HTMLInputElement>('input[type="file"]')!

    it('zeigt eine Datei-Variable als eigene Karte mit einem Dateidialog und speichert Uploads für alle Teams im Draft', async () => {
      mockDefinitions([fileVar()])
      renderView()
      await screen.findByTestId('file-variable-card')

      expect(document.querySelectorAll('input[type="file"]')).toHaveLength(1)
      expect(input()).toHaveAttribute('accept', '.pdf')

      const file = new File(['hello'], 'a.pdf', { type: 'application/pdf' })
      fireEvent.change(input(), { target: { files: [file] } })

      await waitFor(() => expect(draft().fileUploads?.task?.Alpha?.name).toBe('a.pdf'))
      expect(draft().fileUploads?.task?.Beta?.name).toBe('a.pdf')
      expect(draft().fileUploads?.task?.Alpha?.content_b64).toBe(draft().fileUploads?.task?.Beta?.content_b64)
    })

    it('zeigt keine lila Karte, wenn die App nur Datei-Variablen hat', async () => {
      mockDefinitions([fileVar()])
      renderView()
      await screen.findByTestId('file-variable-card')
      expect(screen.queryByText('deployment.summary.appSettings')).toBeNull()
    })

    it('zeigt bei gemischten Variablen die Datei-Karte über der lila Karte mit dem Rest', async () => {
      mockDefinitions([fileVar(), variable({ name: 'region', default: 'eu' })])
      renderView()
      const card = await screen.findByTestId('file-variable-card')
      const purple = await screen.findByText('deployment.summary.appSettings')
      expect(card.compareDocumentPosition(purple) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(screen.getByLabelText('region')).toBeInTheDocument()
      // the file variable is not repeated inside the purple card
      expect(screen.getAllByText('Task')).toHaveLength(1)
    })

    it('nennt die Personen beim Namen und nicht „Team #1“', async () => {
      useDeploymentStore.getState().updateDraft({ groupNames: ['Team #1', 'Team #2'] })
      mockDefinitions([fileVar()])
      renderView()
      await screen.findByTestId('file-variable-card')
      expect(screen.getAllByTestId('file-row').map((r) => r.textContent)).toEqual([
        expect.stringContaining('ann'),
        expect.stringContaining('bob'),
      ])
    })

    it('prüft beim Ablegen die Endung und schreibt bei einer falschen nichts in den Draft', async () => {
      mockDefinitions([fileVar()])
      renderView()
      await screen.findByTestId('file-variable-card')
      fireEvent.drop(screen.getByTestId('file-drop'), { dataTransfer: { files: [new File(['x'], 'a.zip')] } })
      expect(await screen.findByRole('alert')).toBeInTheDocument()
      expect(draft().fileUploads?.task).toBeUndefined()
    })

    it('behält eine Datei, wenn man zurückkommt und den Schritt neu betritt', async () => {
      useDeploymentStore.getState().updateDraft({
        fileUploads: {
          task: {
            Alpha: { name: 'a.pdf', size: 5, content_b64: 'aGVsbG8=', content_type: 'application/pdf' },
            Beta: { name: 'a.pdf', size: 5, content_b64: 'aGVsbG8=', content_type: 'application/pdf' },
          },
        },
      })
      mockDefinitions([fileVar()])
      renderView()
      expect(await screen.findByTestId('file-card')).toHaveTextContent('a.pdf')
    })

    it('zählt Dateien anderer Datei-Variablen zur Gesamtgröße', async () => {
      useDeploymentStore.getState().updateDraft({
        fileUploads: {
          other: { Alpha: { name: 'big.pdf', size: 9 * 1024 * 1024, content_b64: 'x', content_type: 'application/pdf' } },
        },
      })
      mockDefinitions([fileVar(), fileVar({ name: 'other' })])
      renderView()
      const cards = await screen.findAllByTestId('file-variable-card')
      expect(cards).toHaveLength(2)
      // 2 teams × 600 KB = 1,2 MB on top of 9 MB are more than 10 MB together
      const file = new File(['x'], 'b.pdf')
      Object.defineProperty(file, 'size', { value: 600 * 1024 })
      fireEvent.drop(within(cards[0]!).getByTestId('file-drop'), { dataTransfer: { files: [file] } })
      expect(await within(cards[0]!).findByRole('alert')).toBeInTheDocument()
      expect(draft().fileUploads?.task).toBeUndefined()
    })
  })

  describe('Laufzeit der Version', () => {
    it('zeigt die App-Einstellungen, weder Packer noch Terraform', async () => {
      useDeploymentStore.getState().updateDraft({ runtime: 'kubernetes' })
      mockDefinitions([variable({ name: 'greeting', default: 'hi' })])
      renderView()

      expect(await screen.findByText('deployment.summary.appSettings')).toBeInTheDocument()
      expect(screen.queryByText('deployment.summary.packerVars')).not.toBeInTheDocument()
      expect(screen.queryByText('deployment.summary.terraformVars')).not.toBeInTheDocument()
    })

    it('Enum-Variablen sind eine Auswahl', async () => {
      useDeploymentStore.getState().updateDraft({ runtime: 'kubernetes' })
      mockDefinitions([variable({ name: 'size', osType: 'enum', values: ['s', 'm'], default: 's' })])
      renderView()

      expect(await screen.findByTestId('enum-input')).toBeInTheDocument()
    })
  })
})

describe('NewDeploymentVariableView · Windows-VM-App (kubevirt-vm)', () => {
  const vmChoice = {
    container: 'vm',
    cpu: { default: '4', min: '2', max: '8' },
    memory: { default: '8Gi', min: '4Gi', max: '16Gi' },
  }
  const atDefault = { vm: { cpu: '4', memory: '8Gi' } }

  function setVm(over: Record<string, unknown> = {}) {
    mockDefinitions([])
    useDeploymentStore.getState().updateDraft({
      runtime: 'kubevirt-vm',
      scope: 'user',
      studentIds: ['u1', 'u2'],
      resourceChoices: [vmChoice],
      resources: atDefault,
      networkChoices: { internet: { default: true }, podNetwork: { default: false } },
      network: { internet: true, podNetwork: false },
      ...over,
    } as any)
  }
  const head = () => screen.getByRole('button', { name: /deployment\.network\.title/ })

  it('zeigt den Internetzugriff ohne Aufklappen, die Regler nicht', async () => {
    setVm()
    renderView()
    expect(await screen.findByTestId('vm-internet-access')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'deployment.vm.internet.label' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
    expect(head()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByTestId('resource-picker')).toBeNull()
    expect(screen.queryByTestId('network-settings')).toBeNull()
  })

  it('lässt den Standard unverändert, wenn die Experteneinstellungen nie geöffnet werden', async () => {
    setVm()
    renderView()
    await screen.findByTestId('vm-internet-access')
    fireEvent.click(screen.getByRole('button', { name: /deployment\.actions\.next/ }))
    await waitFor(() => expect(screen.getByTestId('where')).not.toHaveTextContent('/deployment/new/variables'))
    expect(draft().resources).toEqual(atDefault)
  })

  it('zeigt aufgeklappt 4 vCPU und 8 GB und speichert Änderungen im Draft', async () => {
    setVm()
    renderView()
    await screen.findByTestId('vm-internet-access')
    fireEvent.click(head())
    expect(screen.getByTestId('cpu-vm')).toHaveTextContent('4')
    expect(screen.getByTestId('memory-vm')).toHaveTextContent('8')
    fireEvent.change(screen.getAllByRole('slider')[0]!, { target: { value: '6000' } })
    expect(draft().resources).toEqual({ vm: { cpu: '6', memory: '8Gi' } })
  })

  it('behält geänderte Werte beim Zuklappen und zeigt sie im Kopf', async () => {
    setVm()
    renderView()
    await screen.findByTestId('vm-internet-access')
    fireEvent.click(head())
    fireEvent.change(screen.getAllByRole('slider')[0]!, { target: { value: '6000' } })
    fireEvent.click(head())
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
    expect(screen.getByTestId('vm-expert-chip')).toHaveTextContent('deployment.vm.expert.changed')
    expect(screen.getByTestId('vm-expert-plate')).toHaveTextContent('6')
    fireEvent.click(head())
    expect(screen.getByTestId('cpu-vm')).toHaveTextContent('6')
    expect(draft().resources).toEqual({ vm: { cpu: '6', memory: '8Gi' } })
  })

  it('schreibt den Internetzugriff in den Draft', async () => {
    setVm()
    renderView()
    fireEvent.click(await screen.findByRole('switch', { name: 'deployment.vm.internet.label' }))
    expect(draft().network).toEqual({ internet: false, podNetwork: false })
    expect(screen.getByTestId('vm-internet-state')).toHaveTextContent('deployment.vm.internet.stateOff')
  })

  it('zeigt Vernetzte Desktops nur aufgeklappt und nur bei zwei Studierenden', async () => {
    setVm()
    renderView()
    await screen.findByTestId('vm-internet-access')
    expect(screen.queryByRole('switch', { name: 'deployment.vm.pods.label' })).toBeNull()
    fireEvent.click(head())
    fireEvent.click(screen.getByRole('switch', { name: 'deployment.vm.pods.label' }))
    expect(draft().network).toEqual({ internet: true, podNetwork: true })
  })

  it('lässt Vernetzte Desktops bei einer Person weg', async () => {
    setVm({ studentIds: ['u1'] })
    renderView()
    await screen.findByTestId('vm-internet-access')
    fireEvent.click(head())
    expect(screen.queryByRole('switch', { name: 'deployment.vm.pods.label' })).toBeNull()
    expect(screen.getAllByRole('slider')).toHaveLength(2)
  })

  it('zeigt für eine VM ohne Auswahl (v2.0.0) den leeren Zustand', async () => {
    setVm({ resourceChoices: [], resources: {}, networkChoices: {}, network: {} })
    renderView()
    expect(await screen.findByText('deployment.variables.noVariables')).toBeInTheDocument()
    expect(screen.queryByTestId('vm-internet-access')).toBeNull()
    expect(screen.queryByTestId('vm-expert-settings')).toBeNull()
  })

  describe('andere Apps bleiben unverändert', () => {
    it('Pod-App mit Auswahl: ResourcePicker oben, Akkordeon mit Internetzugriff und Vernetzten Pods', async () => {
      setVm({
        runtime: 'kubernetes',
        scope: null,
        groupNames: ['A', 'B'],
        groupCount: 2,
        resourceChoices: [{ container: 'web', cpu: { default: '1', min: '500m', max: '2' }, memory: { default: '1Gi', min: '512Mi', max: '2Gi' } }],
        resources: { web: { cpu: '1', memory: '1Gi' } },
        networkChoices: { internet: { default: false }, podNetwork: { default: false } },
        network: { internet: false, podNetwork: false },
      })
      renderView()
      expect(await screen.findByTestId('resource-picker')).toBeInTheDocument()
      expect(screen.getByTestId('network-settings')).toBeInTheDocument()
      expect(screen.queryByTestId('vm-internet-access')).toBeNull()
      expect(screen.queryByTestId('vm-expert-settings')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /deployment\.network\.title/ }))
      expect(screen.getByRole('switch', { name: 'deployment.network.internet.label' })).toBeInTheDocument()
      expect(screen.getByRole('switch', { name: 'deployment.network.podNetwork.label' })).toBeInTheDocument()
    })

    it('Pod-App ohne Auswahl zeigt den leeren Zustand', async () => {
      setVm({ runtime: 'kubernetes', resourceChoices: [], resources: {}, networkChoices: {}, network: {} })
      renderView()
      expect(await screen.findByText('deployment.variables.noVariables')).toBeInTheDocument()
      expect(screen.queryByTestId('vm-internet-access')).toBeNull()
    })
  })

  describe('der Scope, den die Person wählt', () => {
    const podScopeChoice = () =>
      setVm({ runtime: 'kubernetes', scope: 'user', scopeChoice: true, resourceChoices: [], resources: {}, networkChoices: {}, network: {} })

    it('steht in den Experteneinstellungen, auch wenn es sonst nichts einzustellen gibt', async () => {
      podScopeChoice()
      renderView()
      expect(await screen.findByTestId('network-settings')).toBeInTheDocument()
      expect(screen.queryByText('deployment.variables.noVariables')).toBeNull()
      expect(screen.queryByTestId('scope-choice')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /deployment\.network\.title/ }))
      expect(screen.getByRole('radio', { name: /scopeChoice\.user\.label/ })).toBeChecked()
    })

    it('ändert den Scope im Draft', async () => {
      podScopeChoice()
      renderView()
      fireEvent.click(await screen.findByRole('button', { name: /deployment\.network\.title/ }))
      fireEvent.click(screen.getByRole('radio', { name: /scopeChoice\.team\.label/ }))
      expect(draft().scope).toBe('team')
    })

    it('fehlt, wenn die App den Scope festlegt', async () => {
      setVm({ runtime: 'kubernetes', scope: 'user', scopeChoice: false, resourceChoices: [], resources: {}, networkChoices: {}, network: {} })
      renderView()
      expect(await screen.findByText('deployment.variables.noVariables')).toBeInTheDocument()
      expect(screen.queryByTestId('network-settings')).toBeNull()
    })
  })
})
