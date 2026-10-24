import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/api/openstack-resources.api', () => ({ openstackResourcesApi: {} }))
vi.mock('@/composables/useOpenStackResourceCache', async (orig) => {
  const mod = await orig<typeof import('@/composables/useOpenStackResourceCache')>()
  return { ...mod, ensureLoaded: vi.fn(() => Promise.resolve()), setCredential: vi.fn() }
})

import NewDeploymentSummaryView from '@/views/NewDeploymentSummaryView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { useToastStore } from '@/stores/toast.store'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderView = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/deployment/new/summary" element={<NewDeploymentSummaryView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/deployment/new/summary' },
  )

const definitions = [
  { name: 'region', source: 'packer', default: 'us-east' },
  { name: 'instance_type', source: 'terraform', default: 't2.small' },
  { name: 'ssh_key', source: 'terraform', osType: 'file', osScope: 'user' },
]

const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])
const deployButton = () => screen.getByRole('button', { name: 'deployment.actions.deploy' })

function seed(over: Record<string, unknown> = {}) {
  const store = useDeploymentStore.getState()
  store.resetDraft()
  store.studentCache.clear()
  store.studentCache.set('u1', { userId: 'u1', firstName: 'John', lastName: 'Doe' } as any)
  store.updateDraft({
    name: 'My Deployment',
    appId: 'app-1',
    releaseTag: '1.0.0',
    groupCount: 1,
    groupMode: 'one',
    studentIds: ['u1'],
    assignments: [['u1']],
    groupNames: ['Team Alpha'],
    variables: { region: 'eu-central-1', instance_type: 't2.micro' },
    fileUploads: { ssh_key: { u1: { name: 'id_rsa.pub', size: 1024, content_b64: 'x', content_type: 't' } } },
    variableDefinitions: definitions as any,
    ...over,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useAppStore.setState({ apps: [{ appId: 'app-1', name: 'Test App', image: 'test.png' } as any] })
  useOpenStackCredentialsStore.setState({ credentials: [], fetch: vi.fn() } as any)
  seed()
})

describe('NewDeploymentSummaryView', () => {
  it('zeigt die Basiskonfiguration, Teams, und getrennte Packer-/Terraform-/Datei-Variablen', async () => {
    renderView()

    expect(await screen.findByText('My Deployment')).toBeInTheDocument()
    expect(screen.getByText('Test App')).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0)
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    // packer / terraform rows with the draft values
    expect(screen.getByText('eu-central-1')).toBeInTheDocument()
    expect(screen.getByText('t2.micro')).toBeInTheDocument()
    // file summary: name + size, scope
    expect(screen.getByText('id_rsa.pub')).toBeInTheDocument()
    expect(screen.getByText('1 KB')).toBeInTheDocument()
    expect(screen.getByText(/deployment\.summary\.scope/)).toBeInTheDocument()
  })

  it('zeigt die Version "latest" ohne Release-Tag', async () => {
    seed({ releaseTag: '' })
    renderView()
    expect(await screen.findByText('latest')).toBeInTheDocument()
  })

  it('geht über "Zurück" und "Bearbeiten" zu den Variablen', async () => {
    renderView()
    await screen.findByText('My Deployment')

    await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.back/ }))
    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/variables')
  })

  it('sendet die Auswahl unverändert (die Auswahl ist bereits nach User-ID) und leitet bei Erfolg zur Liste', async () => {
    const submitDraft = vi.fn().mockImplementation(async () => {
      const draft = useDeploymentStore.getState().draft
      expect(draft.studentIds).toEqual(['u1'])
      expect((draft.assignments as any)[0]).toEqual(['u1'])
      return { deploymentId: 'dep-123' }
    })
    useDeploymentStore.setState({ submitDraft } as any)
    renderView()
    await screen.findByText('My Deployment')

    await userEvent.click(deployButton())

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/deployments'))
    expect(submitDraft).toHaveBeenCalledTimes(1)
    expect(toasts()).toContainEqual(['success', 'deployment.summary.submitSuccess'])
    // The draft is reset for the next run.
    expect(useDeploymentStore.getState().draft.name).toBe('')
  })

  it('übersetzt Backend-Fehler in einen Toast und lässt den Entwurf unberührt', async () => {
    useDeploymentStore.setState({
      submitDraft: vi.fn().mockRejectedValue({
        response: {
          data: { detail: { reason: 'file_too_large', filename: 'test.zip', actual_bytes: 3145728, limit_bytes: 2097152 } },
        },
      }),
    } as any)
    renderView()
    await screen.findByText('My Deployment')

    await userEvent.click(deployButton())

    await waitFor(() => expect(toasts().some(([type]) => type === 'error')).toBe(true))
    expect(toasts()[0]![1]).toContain('deployment.summary.errors.fileTooLarge')
    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/summary')
    expect(useDeploymentStore.getState().draft.studentIds).toEqual(['u1'])
  })

  it.each([
    [{ code: 'version_not_approved' }, 'deployment.summary.errors.version_not_approved'],
    [{ reason: 'workload_budget_exceeded', in_use: 8, requested: 4, budget: 10 }, 'deployment.summary.errors.workload_budget_exceeded'],
    [{ reason: 'openstack_credentials_unverified' }, 'deployment.summary.errors.openstack_credentials_unverified'],
  ])('nennt den Grund einer Ablehnung durch die API (%j)', async (detail, key) => {
    useDeploymentStore.setState({ submitDraft: vi.fn().mockRejectedValue({ response: { data: { detail } } }) } as any)
    renderView()
    await screen.findByText('My Deployment')

    await userEvent.click(deployButton())

    await waitFor(() => expect(toasts()[0]?.[1]).toContain(key))
  })

  describe('Laufzeit', () => {
    it('eine Pod-App nennt die Laufzeit und zeigt weder Packer noch ein Projekt', async () => {
      seed({ runtime: 'kubernetes' })
      renderView()

      const runtime = await screen.findByTestId('summary-runtime')
      expect(runtime).toHaveTextContent('runtime.kubernetes')
      expect(runtime).not.toHaveTextContent('deployment.summary.projectLabel')
      expect(screen.queryByText('deployment.summary.packerVars')).not.toBeInTheDocument()
      expect(screen.getByText('deployment.summary.appSettings')).toBeInTheDocument()
    })

    it('eine VM-App nennt das OpenStack-Projekt des gewählten Credentials', async () => {
      useOpenStackCredentialsStore.setState({
        credentials: [{ credentialId: 'c-1', project_name: 'Projekt Eins', project_verified: true }],
      } as any)
      seed({ runtime: 'openstack-vm', credentialId: 'c-1' })
      renderView()

      const runtime = await screen.findByTestId('summary-runtime')
      expect(runtime).toHaveTextContent('runtime.openstackVm')
      expect(runtime).toHaveTextContent('Projekt Eins')
      expect(screen.getByText('deployment.summary.packerVars')).toBeInTheDocument()
    })
  })

  it('verhindert einen Doppel-Submit', async () => {
    let release!: (v: unknown) => void
    const submitDraft = vi.fn(() => new Promise((resolve) => (release = resolve)))
    useDeploymentStore.setState({ submitDraft } as any)
    renderView()
    await screen.findByText('My Deployment')

    await userEvent.click(deployButton())
    await waitFor(() => expect(submitDraft).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /deployment\.summary\.creating/ })).toBeDisabled()

    release({ deploymentId: 'd' })
  })

  describe('fehlende Variablen-Definitionen (Deep-Link)', () => {
    it('lädt sie nach und ergänzt die Defaults im Draft', async () => {
      seed({ variableDefinitions: [], variables: { instance_type: 't3.large' } })
      const fetchAppVariables = vi.fn().mockResolvedValue(definitions)
      useAppStore.setState({ fetchAppVariables } as any)
      renderView()

      expect(await screen.findByText('t3.large')).toBeInTheDocument()
      expect(fetchAppVariables).toHaveBeenCalledWith('app-1', '1.0.0')
      expect(useDeploymentStore.getState().draft.variables).toMatchObject({ region: 'us-east', instance_type: 't3.large' })
      expect(useDeploymentStore.getState().draft.variableDefinitions).toHaveLength(3)
    })

    it('meldet einen Ladefehler', async () => {
      seed({ variableDefinitions: [] })
      useAppStore.setState({ fetchAppVariables: vi.fn().mockRejectedValue({ response: { status: 500 } }) } as any)
      vi.spyOn(console, 'error').mockImplementation(() => {})
      renderView()

      await waitFor(() => expect(toasts()).toContainEqual(['error', 'deployment.summary.fetchVarsError500']))
    })
  })

  describe('Experteneinstellungen', () => {
    const choices = { internet: { default: false }, podNetwork: { default: false } }
    const pods = (network: Record<string, boolean>, over: Record<string, unknown> = {}) =>
      seed({
        runtime: 'kubernetes',
        groupCount: 2,
        groupNames: ['Team A', 'Team B'],
        networkChoices: choices,
        network,
        ...over,
      })

    it('zeigt nur die vom Default abweichende Einstellung', async () => {
      pods({ internet: true, podNetwork: false })
      renderView()
      const line = await screen.findByTestId('summary-network-internet')
      expect(line).toHaveTextContent('deployment.network.internet.label')
      expect(line).toHaveTextContent('deployment.network.summaryOn')
      expect(screen.queryByTestId('summary-network-podNetwork')).toBeNull()
    })

    it('zeigt nichts, wenn alles dem Default entspricht', async () => {
      pods({ internet: false, podNetwork: false })
      renderView()
      await screen.findByText('My Deployment')
      expect(screen.queryByTestId('summary-network')).toBeNull()
    })

    it('zeigt nichts bei einer VM-App', async () => {
      pods({ internet: true, podNetwork: true }, { runtime: 'openstack-vm' })
      renderView()
      await screen.findByText('My Deployment')
      expect(screen.queryByTestId('summary-network')).toBeNull()
    })
  })
})
