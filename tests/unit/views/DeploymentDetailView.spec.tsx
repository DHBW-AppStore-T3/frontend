import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router'
import { I18nextProvider } from 'react-i18next'

import type { DeploymentWithRelations, Task } from '@/types'

// ---------------------------------------------------------
// 1. Mocks & setup
// ---------------------------------------------------------

const mocks = vi.hoisted(() => ({
  listTasks: vi.fn(),
  getTask: vi.fn(),
  getMyAccess: vi.fn(),
  getDeployment: vi.fn(),
  deleteDeployment: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  cancel: vi.fn(),
  listResources: vi.fn(),
  startStream: vi.fn(),
  stopStream: vi.fn(),
  stream: {
    progress: null as number | null,
    currentPhase: null as string | null,
    currentPhaseIndex: null as number | null,
    totalPhases: 11,
    phaseNames: [] as string[],
    liveLogs: [] as unknown[],
    totalLogCount: 0,
    connectionState: 'idle' as string,
    lastError: null,
  },
}))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))

vi.mock('@/api/task.api', () => ({
  taskApi: { listByDeployment: mocks.listTasks, getById: mocks.getTask },
}))

vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    getById: mocks.getDeployment,
    delete: mocks.deleteDeployment,
    pause: mocks.pause,
    resume: mocks.resume,
    cancel: mocks.cancel,
    getMyAccess: mocks.getMyAccess,
    listResources: mocks.listResources,
    redeployResource: vi.fn(),
    getResourceDetail: vi.fn(() => new Promise(() => {})),
  },
}))

vi.mock('@/composables/useDeploymentStream', () => ({
  useDeploymentStream: () => ({
    ...mocks.stream,
    start: mocks.startStream,
    stop: mocks.stopStream,
  }),
}))

import DeploymentDetailView from '@/views/DeploymentDetailView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { keyEchoI18n } from '../../helpers/render'

const baseDeployment = (overrides: Partial<DeploymentWithRelations> = {}): DeploymentWithRelations => ({
  deploymentId: 'dep-1',
  name: 'Data Lab',
  appId: 'app-1',
  userId: 'user-owner',
  status: 'success',
  commitHash: null,
  commitInfo: null,
  userInputVar: JSON.stringify({
    groupNames: ['Group A'],
    assignments: { 0: ['student-1', 'student-2'] },
    variables: { image: 'ubuntu:22.04 # default image', note: 'hello' },
  }),
  releaseTag: 'v1.2.3',
  created_at: '2026-06-08T12:00:00Z',
  user: {
    userId: 'user-owner',
    username: 'owner',
    email: 'owner@example.com',
    role: 'teacher',
    courseId: null,
    created_at: '2026-06-01T00:00:00Z',
  },
  app: {
    appId: 'app-1',
    name: 'Notebook Stack',
    description: 'Jupyter deployment',
    git_link: 'https://git.example/app.git',
    userId: 'user-owner',
    created_at: '2026-06-01T00:00:00Z',
    releaseTag: 'v1.2.3',
    is_private: false,
  },
  teams: [
    {
      teamId: 'team-1',
      name: 'Team Alpha',
      members: [{ userId: 'member-1', username: 'member.one', email: 'member1@example.com' }],
    },
  ],
  outputs: null,
  logs: null,
  latest_task: null,
  ...overrides,
}) as DeploymentWithRelations

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  taskId: 'task-1',
  deploymentId: 'dep-1',
  celeryTaskId: 'celery-1',
  type: 'deploy',
  status: 'success',
  started_at: '2026-06-08T12:10:00Z',
  finished_at: '2026-06-08T12:20:00Z',
  logs: { logs: [{ timestamp: '2026-06-08T12:15:00Z', level: 'INFO', message: 'hello from the worker' }] },
  tf_state: { resources: [{ name: 'vm-1' }] },
  outputs: { url: 'https://example.org' },
  current_phase: 'OUTPUTS_AND_CLEANUP',
  progress_pct: 100,
  created_at: '2026-06-08T12:09:00Z',
  ...overrides,
}) as Task

function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="location">{loc.pathname}</div>
}

function renderView() {
  return render(
    <I18nextProvider i18n={keyEchoI18n()}>
      <MemoryRouter initialEntries={['/deployments/dep-1']}>
        <Routes>
          <Route path="/deployments/:id" element={<DeploymentDetailView />} />
          <Route path="/deployments" element={<p>deployments list</p>} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </I18nextProvider>,
  )
}

const asStaff = () =>
  useAuthStore.setState({ user: { userId: 'user-owner', role: 'teacher' } as any, isAuthenticated: true })
const asMember = () =>
  useAuthStore.setState({ user: { userId: 'member-1', role: 'student' } as any, isAuthenticated: true })

const toastCalls = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useDeploymentStore.setState({ currentDeployment: null, deployments: [], error: null })
  asStaff()

  mocks.stream.progress = null
  mocks.stream.currentPhase = null
  mocks.stream.currentPhaseIndex = null
  mocks.stream.totalPhases = 11
  mocks.stream.phaseNames = []
  mocks.stream.liveLogs = []
  mocks.stream.totalLogCount = 0
  mocks.stream.connectionState = 'idle'

  mocks.getDeployment.mockImplementation(async () => ({ data: baseDeployment() }))
  mocks.deleteDeployment.mockResolvedValue({ status: 204 })
  mocks.listTasks.mockResolvedValue({ data: [baseTask()] })
  mocks.getTask.mockResolvedValue({ data: baseTask() })
  mocks.getMyAccess.mockResolvedValue({ data: { user_accounts: null, team_vms: null } })
  mocks.listResources.mockResolvedValue({ data: { resources: [] } })
})

// ---------------------------------------------------------
// 2. Tests
// ---------------------------------------------------------

describe('DeploymentDetailView', () => {
  // --- 1. Lifecycle & data loading ---

  it('lädt Deployment und Tasks beim Öffnen der Detailseite', async () => {
    renderView()

    expect(await screen.findByText('owner@example.com')).toBeInTheDocument()
    expect(mocks.getDeployment).toHaveBeenCalledWith('dep-1')
    expect(mocks.listTasks).toHaveBeenCalledWith('dep-1')
    expect(screen.getAllByText('Data Lab').length).toBeGreaterThan(0)
    expect(screen.getByText('Notebook Stack')).toBeInTheDocument()
  })

  it('zeigt einen Spinner solange das Deployment nicht geladen ist', () => {
    mocks.getDeployment.mockReturnValue(new Promise(() => {}))
    const { container } = renderView()
    expect(container.querySelector('.animate-spin')).not.toBeNull()
  })

  it('zeigt Gruppen-, Variablen- und Teamdaten aus dem Deployment', async () => {
    renderView()

    expect(await screen.findByText('Group A')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('member.one')).toBeInTheDocument()
    expect(screen.getByText('ubuntu:22.04')).toBeInTheDocument()
    expect(screen.queryByText(/# default image/)).not.toBeInTheDocument()

    await userEvent.click(screen.getAllByTestId('group-card')[0]!)

    expect(screen.getByText('student-1')).toBeInTheDocument()
    expect(screen.getByText('student-2')).toBeInTheDocument()

    await userEvent.click(screen.getByText('DeploymentDetailView.deploymentGroupsBack'))
    expect(screen.getAllByTestId('group-card')).toHaveLength(1)
  })

  it('navigiert zur Liste mit Fehler-Toast wenn das Deployment nicht existiert', async () => {
    mocks.getDeployment.mockRejectedValue({ response: { status: 404 } })
    renderView()

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/deployments'))
    expect(toastCalls()).toContainEqual(['error', 'Deployment nicht gefunden.'])
  })

  // --- 2. Role & visibility logic ---

  it('blendet Tasks und Löschaktion für Nicht-Besitzer aus', async () => {
    asMember()
    mocks.getDeployment.mockImplementation(async () => ({ data: baseDeployment({ userId: 'user-owner' }) }))
    renderView()

    expect(await screen.findByText('DeploymentDetailView.tasksOwnerOnly')).toBeInTheDocument()
    expect(mocks.listTasks).not.toHaveBeenCalled()
    expect(screen.queryByText('DeploymentDetailView.deploymentDelete')).not.toBeInTheDocument()
    expect(mocks.listResources).not.toHaveBeenCalled()
  })

  // --- 3. Task details & actions ---

  it('lädt und zeigt Task-Details, wenn ein Task aus der Historie geöffnet wird', async () => {
    renderView()

    const rows = await screen.findAllByTestId('task-row')
    expect(rows[rows.length - 1]).toHaveTextContent('deploy')

    await userEvent.click(rows[rows.length - 1]!)

    expect(await screen.findByText('Task ID')).toBeInTheDocument()
    expect(mocks.getTask).toHaveBeenCalledWith('task-1')
    expect(screen.getByText('celery-1')).toBeInTheDocument()
    expect(screen.getByText(/hello from the worker/)).toBeInTheDocument()
    expect(screen.getByText('1 entries')).toBeInTheDocument()
  })

  it('zeigt bei fehlgeschlagenen String-Logs Headline und klappbare Details', async () => {
    mocks.getTask.mockResolvedValue({
      data: baseTask({ status: 'failed', logs: 'Worker lost\n--- Technische Details ---\nTraceback here' }),
    })
    renderView()

    await userEvent.click((await screen.findAllByTestId('task-row'))[0]!)

    expect(await screen.findByText('Worker lost')).toBeInTheDocument()
    expect(screen.queryByText('Traceback here')).not.toBeInTheDocument()

    await userEvent.click(screen.getByText('Technische Details anzeigen'))
    expect(screen.getByText('Traceback here')).toBeInTheDocument()
  })

  it('öffnet den Delete-Dialog und löst den Lösch-Flow aus (204)', async () => {
    renderView()

    await userEvent.click(await screen.findByTestId('btn-delete-deployment'))
    await userEvent.click(await screen.findByTestId('btn-confirm-delete'))

    await waitFor(() => expect(mocks.deleteDeployment).toHaveBeenCalledWith('dep-1'))
    expect(toastCalls()).toContainEqual(['success', 'DeploymentDetailView.deleteSuccessToast'])
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/deployments'))
  })

  it('bleibt bei 202 auf der Seite und lädt Deployment und Tasks neu', async () => {
    mocks.deleteDeployment.mockResolvedValue({ status: 202 })
    renderView()
    await screen.findByTestId('btn-delete-deployment')
    mocks.getDeployment.mockClear()
    mocks.listTasks.mockClear()

    await userEvent.click(screen.getByTestId('btn-delete-deployment'))
    await userEvent.click(await screen.findByTestId('btn-confirm-delete'))

    await waitFor(() => expect(mocks.getDeployment).toHaveBeenCalledWith('dep-1'))
    await waitFor(() => expect(mocks.listTasks).toHaveBeenCalled())
    expect(toastCalls()).toContainEqual(['info', 'DeploymentDetailView.deleteStartedToast'])
    expect(screen.getByTestId('location')).toHaveTextContent('/deployments/dep-1')
  })

  it('zeigt einen Fehler-Toast wenn das Löschen fehlschlägt', async () => {
    mocks.deleteDeployment.mockRejectedValue({ response: { data: { detail: 'nope' } } })
    renderView()

    await userEvent.click(await screen.findByTestId('btn-delete-deployment'))
    await userEvent.click(await screen.findByTestId('btn-confirm-delete'))

    await waitFor(() =>
      expect(toastCalls().some(([type, msg]) => type === 'error' && String(msg).includes('nope'))).toBe(true),
    )
  })

  it('deaktiviert Delete, solange der Status kein Löschen erlaubt', async () => {
    mocks.getDeployment.mockImplementation(async () => ({ data: baseDeployment({ status: 'running' }) }))
    renderView()

    expect(await screen.findByTestId('btn-delete-deployment')).toBeDisabled()
  })

  it('startet Pause nach Bestätigung', async () => {
    mocks.pause.mockResolvedValue({ data: { task_id: 't', status: 'pausing' } })
    renderView()

    await userEvent.click(
      await screen.findByRole('button', { name: /DeploymentDetailView\.deploymentPause/ }),
    )
    // The modal confirm button shares the label; it is the last one rendered.
    const buttons = screen.getAllByRole('button', { name: 'DeploymentDetailView.deploymentPause' })
    await userEvent.click(buttons[buttons.length - 1]!)

    await waitFor(() => expect(mocks.pause).toHaveBeenCalledWith('dep-1'))
    expect(toastCalls()).toContainEqual(['info', 'DeploymentDetailView.pauseStartedToast'])
  })

  // --- 4. Live stream ---

  it('startet den Stream wenn ein Task läuft und zeigt den Fortschritt', async () => {
    mocks.listTasks.mockResolvedValue({
      data: [baseTask({ status: 'running', current_phase: 'TERRAFORM_APPLY', progress_pct: 60 })],
    })
    renderView()

    await waitFor(() => expect(mocks.startStream).toHaveBeenCalledTimes(1))
    // Seeded from the DB task before the first SSE event.
    // Headline + the matching stepper dot label.
    expect((await screen.findAllByText('Terraform Apply')).length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('60')).toBeInTheDocument()
  })

  it('zeigt "Worker is starting up…" ohne Phase-Information', async () => {
    mocks.listTasks.mockResolvedValue({
      data: [baseTask({ status: 'running', current_phase: null, progress_pct: null })],
    })
    renderView()

    expect(await screen.findByText('Worker is starting up…')).toBeInTheDocument()
  })

  it('startet den Stream nicht für Mitglieder', async () => {
    asMember()
    mocks.getDeployment.mockImplementation(async () => ({ data: baseDeployment() }))
    renderView()

    await screen.findByText('DeploymentDetailView.tasksOwnerOnly')
    expect(mocks.startStream).not.toHaveBeenCalled()
  })

  it('wechselt nach erfolgreichem Destroy mit Toast zur Liste (Deployment weg)', async () => {
    mocks.listTasks.mockResolvedValue({ data: [baseTask({ type: 'destroy', status: 'running' })] })
    const view = renderView()
    await waitFor(() => expect(mocks.startStream).toHaveBeenCalled())

    // The refetch will 404 (soft-deleted) → store clears currentDeployment.
    mocks.getDeployment.mockRejectedValue({ response: { status: 404 } })
    mocks.stream.connectionState = 'ended'
    await act(async () => {
      view.rerender(
        <I18nextProvider i18n={keyEchoI18n()}>
          <MemoryRouter initialEntries={['/deployments/dep-1']}>
            <Routes>
              <Route path="/deployments/:id" element={<DeploymentDetailView />} />
              <Route path="/deployments" element={<p>deployments list</p>} />
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </I18nextProvider>,
      )
    })

    await waitFor(() => expect(toastCalls()).toContainEqual(['success', 'DeploymentDetailView.deleteSuccessToast']))
  })
})

// ---------------------------------------------------------
// Member self-access (own credentials via /my-access)
// ---------------------------------------------------------
describe('DeploymentDetailView — member self-access', () => {
  beforeEach(() => {
    asMember()
    mocks.getDeployment.mockImplementation(async () => ({ data: baseDeployment({ userId: 'user-owner' }) }))
    mocks.listTasks.mockResolvedValue({ data: [] })
    mocks.getMyAccess.mockResolvedValue({
      data: {
        // Key mirrors the terraform contract the view derives:
        // "<team>-<email-local-part with dots→dashes>".
        user_accounts: {
          'Team Alpha-member1': {
            username: 'member1',
            team: 'Team Alpha',
            ip: '10.0.0.5',
            port: 22,
            auth: 'super-secret-pw',
            type: 'password',
          },
        },
        team_vms: {},
      },
    })
  })

  it('lädt die eigenen Zugangsdaten über /my-access statt über die Task-Liste', async () => {
    renderView()

    // The own credential renders in the Teams card.
    expect(await screen.findByText('ssh member1@10.0.0.5')).toBeInTheDocument()
    expect(mocks.getMyAccess).toHaveBeenCalledWith('dep-1')
    expect(mocks.listTasks).not.toHaveBeenCalled()
  })

  it('verbirgt das Passwort bis es aufgedeckt wird', async () => {
    renderView()
    await screen.findByText('ssh member1@10.0.0.5')

    expect(screen.queryByText('super-secret-pw')).not.toBeInTheDocument()
    expect(screen.getByText('••••••••')).toBeInTheDocument()
  })

  it('ruft /my-access NICHT auf, wenn der Nutzer Owner-View hat', async () => {
    asStaff()
    renderView()

    await screen.findByText('owner@example.com')
    expect(mocks.getMyAccess).not.toHaveBeenCalled()
  })

  it('bietet kein Zugang-erneut-senden mehr an (die API stellt es nicht mehr bereit)', async () => {
    mocks.getDeployment.mockImplementation(async () => ({
      data: baseDeployment({
        userId: 'user-owner',
        teams: [
          {
            teamId: 'team-1',
            name: 'Team Alpha',
            members: [{ userId: 'member-1', username: 'member.one', email: 'member1@example.com' }],
          },
        ],
      }),
    }))
    renderView()

    await screen.findByText('member.one')
    expect(screen.queryByText('DeploymentDetailView.resendAccessButton')).not.toBeInTheDocument()
  })
})
