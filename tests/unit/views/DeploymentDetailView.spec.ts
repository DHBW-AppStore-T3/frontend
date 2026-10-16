import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { h, nextTick, ref } from 'vue'

import DeploymentDetailView from '@/views/DeploymentDetailView.vue'
import DeploymentInfrastructurePanel from '@/components/DeploymentInfrastructurePanel.vue'
import type { DeploymentWithRelations, PodWorkload, Task } from '@/types'

// ---------------------------------------------------------
// 1. Mocks & Setup
// ---------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockFetchDeploymentById: vi.fn(),
  mockDeleteDeployment: vi.fn(),
  mockCancelDeployment: vi.fn(),
  mockListTasksByDeployment: vi.fn(),
  mockGetTaskById: vi.fn(),
  mockGetMyAccess: vi.fn(),
  mockListResources: vi.fn(),
  mockRedeployResource: vi.fn(),
  mockRestartWorkload: vi.fn(),
  mockResetWorkload: vi.fn(),
  mockAddToast: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockStartStream: vi.fn(),
  mockStopStream: vi.fn(),
}))

const mockDeployment = ref<DeploymentWithRelations | null>(null)
const mockStoreError = ref<string | null>(null)
const mockAuthUserId = ref('user-owner')

const mockStreamProgress = ref<number | null>(null)
const mockStreamCurrentPhase = ref<string | null>(null)
const mockStreamCurrentPhaseIndex = ref<number | null>(null)
const mockStreamTotalPhases = ref(11)
const mockStreamLiveLogs = ref([])
const mockStreamTotalLogCount = ref(0)
const mockStreamConnectionState = ref<'idle' | 'connecting' | 'live' | 'reconnecting' | 'ended' | 'error'>('idle')
const mockStreamPhaseNames = ref<string[]>([])

// Every icon becomes a tiny stub, so an icon added to the view or one of
// its panels needs no change here.
vi.mock('lucide-vue-next', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return Object.fromEntries(
    Object.keys(actual).map((n) => [n, { template: `<span class="icon-${n.toLowerCase()}" />` }]),
  )
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'dep-1' } }),
  useRouter: () => ({ push: mocks.mockPush }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key, te: () => false }),
}))

vi.mock('@/stores/deployment.store', () => ({
  useDeploymentStore: () => ({
    get currentDeployment() {
      return mockDeployment.value
    },
    get error() {
      return mockStoreError.value
    },
    fetchDeploymentById: mocks.mockFetchDeploymentById,
    deleteDeployment: mocks.mockDeleteDeployment,
    cancelDeployment: mocks.mockCancelDeployment,
  }),
}))

// The page decides nothing from the role: what the caller may see and do
// comes with the deployment (``permissions``/``actions``).
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    get userId() {
      return mockAuthUserId.value
    },
  }),
}))

vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    addToast: mocks.mockAddToast,
    success: mocks.mockToastSuccess,
    error: mocks.mockToastError,
  }),
}))

vi.mock('@/api/task.api', () => ({
  taskApi: {
    listByDeployment: mocks.mockListTasksByDeployment,
    getById: mocks.mockGetTaskById,
  },
}))

vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    getMyAccess: mocks.mockGetMyAccess,
    listResources: mocks.mockListResources,
    redeployResource: mocks.mockRedeployResource,
    restartWorkload: mocks.mockRestartWorkload,
    resetWorkload: mocks.mockResetWorkload,
  },
}))

vi.mock('@/composables/useDeploymentStream', () => ({
  useDeploymentStream: () => ({
    progress: mockStreamProgress,
    currentPhase: mockStreamCurrentPhase,
    currentPhaseIndex: mockStreamCurrentPhaseIndex,
    totalPhases: mockStreamTotalPhases,
    phaseNames: mockStreamPhaseNames,
    liveLogs: mockStreamLiveLogs,
    totalLogCount: mockStreamTotalLogCount,
    connectionState: mockStreamConnectionState,
    start: mocks.mockStartStream,
    stop: mocks.mockStopStream,
  }),
}))

const OWNER = { owner_view: true, operate: true, member: false }
const MEMBER = { owner_view: false, operate: false, member: true }

const baseDeployment = (overrides: Partial<DeploymentWithRelations> = {}): DeploymentWithRelations => ({
  deploymentId: 'dep-1',
  name: 'Data Lab',
  appId: 'app-1',
  userId: 'user-owner',
  status: 'success',
  runtime: 'openstack-vm',
  commitHash: null,
  commitInfo: null,
  userInputVar: JSON.stringify({
    groupNames: ['Group A'],
    assignments: {
      0: ['student-1', 'student-2'],
    },
    variables: {
      image: 'ubuntu:22.04 # default image',
      note: 'hello',
    },
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
      members: [
        { userId: 'member-1', username: 'member.one', email: 'member1@example.com' },
        { userId: 'member-2', username: 'member.two', email: 'member2@example.com' },
      ],
    },
  ],
  outputs: null,
  logs: null,
  latest_task: null,
  permissions: OWNER,
  actions: ['destroy', 'pause', 'redeploy'],
  ...overrides,
} as DeploymentWithRelations)

const podDeployment = (overrides: Partial<DeploymentWithRelations> = {}) =>
  baseDeployment({ runtime: 'kubernetes', actions: ['destroy', 'pause', 'redeploy'], ...overrides })

const workload = (overrides: Partial<PodWorkload> = {}): PodWorkload => ({
  workload: 'team-alpha',
  team: 'Team Alpha',
  user_id: null,
  ready: true,
  restarts: 0,
  phase: 'Running',
  url: 'https://lab.example/team-alpha/',
  lastEvent: null,
  ...overrides,
})

const baseTask = (overrides: Partial<Task> = {}): Task => ({
  taskId: 'task-1',
  deploymentId: 'dep-1',
  celeryTaskId: 'celery-1',
  type: 'deploy',
  status: 'success',
  started_at: '2026-06-08T12:10:00Z',
  finished_at: '2026-06-08T12:20:00Z',
  logs: {
    logs: [
      {
        timestamp: '2026-06-08T12:15:00Z',
        level: 'INFO',
        message: 'hello from the worker',
      },
    ],
  },
  current_phase: 'OUTPUTS_AND_CLEANUP',
  progress_pct: 100,
  created_at: '2026-06-08T12:09:00Z',
  ...overrides,
})

// ``<i18n-t>`` comes from the vue-i18n plugin; render its keypath and slots.
const I18nT = {
  props: ['keypath', 'tag'],
  setup(props: { keypath: string }, { slots }: { slots: Record<string, (() => unknown[]) | undefined> }) {
    return () => h('p', { class: 'i18n-t' }, [props.keypath, ...Object.values(slots).flatMap((s) => (s ? s() : []))] as any)
  },
}

/** Serve ``deployment`` from the next fetchDeploymentById call on. */
const serve = (deployment: DeploymentWithRelations | null) => {
  mocks.mockFetchDeploymentById.mockImplementation(async () => {
    mockDeployment.value = deployment
    return deployment
  })
}

const mountComponent = () =>
  mount(DeploymentDetailView, {
    global: {
      mocks: {
        $t: (key: string, vars?: Record<string, unknown>) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
      },
      components: { 'i18n-t': I18nT },
      stubs: {
        RouterLink: true,
        BaseButton: {
          inheritAttrs: false,
          props: ['disabled', 'title'],
          template: '<button v-bind="$attrs" :disabled="disabled" :title="title"><slot /></button>',
        },
        Modal: {
          props: ['show'],
          // Renders the footer slot too: the confirm/cancel pair lives there.
          template:
            '<div v-if="$props.show" class="modal">' +
            '<slot name="title" /><slot name="body" /><slot /><slot name="footer" />' +
            '</div>',
        },
        InfrastructureVmCard: { template: '<div class="vm-card-stub" />' },
        InfrastructureVmDrawer: { template: '<div class="vm-drawer-stub" />' },
        MarkdownRenderer: {
          props: ['source'],
          template: '<div class="markdown-stub">{{ source }}</div>',
        },
      },
    },
  })

beforeEach(() => {
  vi.clearAllMocks()

  mockDeployment.value = null
  mockStoreError.value = null
  mockAuthUserId.value = 'user-owner'

  mockStreamProgress.value = null
  mockStreamCurrentPhase.value = null
  mockStreamCurrentPhaseIndex.value = null
  mockStreamTotalPhases.value = 11
  mockStreamPhaseNames.value = []
  mockStreamLiveLogs.value = []
  mockStreamTotalLogCount.value = 0
  mockStreamConnectionState.value = 'idle'

  serve(baseDeployment())
  mocks.mockDeleteDeployment.mockResolvedValue({ status: 204 })
  mocks.mockListTasksByDeployment.mockResolvedValue({ data: [baseTask()] })
  mocks.mockGetTaskById.mockResolvedValue({ data: baseTask() })
  mocks.mockGetMyAccess.mockResolvedValue({ data: { user_accounts: null, team_vms: null } })
  mocks.mockListResources.mockResolvedValue({ data: { resources: [], workloads: [], live: true } })
  mocks.mockRestartWorkload.mockResolvedValue({ data: {} })
  mocks.mockResetWorkload.mockResolvedValue({ data: {} })
})

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

describe('DeploymentDetailView.vue', () => {
  // --- 1. Lifecycle & Datenladen ---

  it('lädt Deployment und Tasks beim Öffnen der Detailseite', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(mocks.mockFetchDeploymentById).toHaveBeenCalledWith('dep-1')
    expect(mocks.mockListTasksByDeployment).toHaveBeenCalledWith('dep-1')
    expect(wrapper.text()).toContain('Data Lab')
    expect(wrapper.text()).toContain('Notebook Stack')
    expect(wrapper.text()).toContain('owner@example.com')
    expect(wrapper.find('[data-testid="deployment-runtime"]').text()).toBe('runtime.openstackVm')
  })

  it('zeigt Gruppen-, Variablen- und Teamdaten aus dem Deployment', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('Group A')
    expect(wrapper.text()).toContain('Team Alpha')
    expect(wrapper.text()).toContain('member.one')
    expect(wrapper.text()).toContain('ubuntu:22.04')
    expect(wrapper.text()).not.toContain('# default image')

    const groupCard = wrapper.findAll('[data-testid="group-card"]')[0]
    expect(groupCard?.text()).toContain('Group A')

    await groupCard!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('student-1')
    expect(wrapper.text()).toContain('student-2')
  })

  it('leitet zur Liste zurück, wenn das Deployment nicht existiert', async () => {
    serve(null)

    mountComponent()
    await flushPromises()

    expect(mocks.mockToastError).toHaveBeenCalledWith('DeploymentDetailView.notFound')
    expect(mocks.mockPush).toHaveBeenCalledWith({ name: 'deployments.list' })
    expect(mocks.mockListTasksByDeployment).not.toHaveBeenCalled()
  })

  it('meldet fehlenden Zugriff, wenn die API das Deployment verweigert', async () => {
    serve(null)
    mockStoreError.value = 'Request failed with status code 404'

    mountComponent()
    await flushPromises()

    expect(mocks.mockToastError).toHaveBeenCalledWith('DeploymentDetailView.noAccess')
  })

  // --- 2. Rechte kommen von der API, nicht aus der Rolle ---

  it('ohne Owner-View: keine Tasks, keine Infrastruktur, kein Löschen', async () => {
    // e.g. another teacher who opens the link: the role alone grants nothing.
    serve(baseDeployment({ permissions: { owner_view: false, operate: false, member: false }, actions: [] }))

    const wrapper = mountComponent()
    await flushPromises()

    expect(mocks.mockListTasksByDeployment).not.toHaveBeenCalled()
    expect(mocks.mockListResources).not.toHaveBeenCalled()
    expect(mocks.mockGetMyAccess).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('DeploymentDetailView.tasksOwnerOnly')
    expect(wrapper.find('[data-testid="btn-delete-deployment"]').exists()).toBe(false)
  })

  it('Owner-View ohne Bedienrecht (Admin bei einer VM-App) darf nichts auslösen', async () => {
    serve(baseDeployment({
      permissions: { owner_view: true, operate: false, member: false },
      actions: ['destroy', 'pause', 'redeploy'],
    }))

    const wrapper = mountComponent()
    await flushPromises()

    // Sees everything ...
    expect(mocks.mockListTasksByDeployment).toHaveBeenCalled()
    // ... but every lifecycle action is off.
    const deleteButton = wrapper.find('[data-testid="btn-delete-deployment"]')
    expect(deleteButton.attributes('disabled')).toBeDefined()
    expect(deleteButton.attributes('title')).toBe('DeploymentDetailView.deleteUnavailable')
    expect(wrapper.text()).not.toContain('DeploymentDetailView.deploymentPause')
    expect(wrapper.findComponent(DeploymentInfrastructurePanel).props('canRedeploy')).toBe(false)
  })

  it('zeigt nur die Aktionen, die der Lebenszyklus gerade erlaubt', async () => {
    // A task is running: only "stop" makes sense.
    serve(baseDeployment({ status: 'running', actions: ['cancel'] }))

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.text()).toContain('DeploymentDetailView.deploymentStop')
    expect(wrapper.text()).not.toContain('DeploymentDetailView.deploymentPause')
    expect(wrapper.find('[data-testid="btn-delete-deployment"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findComponent(DeploymentInfrastructurePanel).props('canRedeploy')).toBe(false)
  })

  // --- 3. Task-Details & Aktionen ---

  it('lädt und zeigt Task-Details, wenn ein Task aus der Historie geöffnet wird', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const taskRows = wrapper.findAll('[data-testid="task-row"]')
    const taskRow = taskRows[taskRows.length - 1]
    expect(taskRow?.text()).toContain('deploy')

    await taskRow!.trigger('click')
    await flushPromises()

    expect(mocks.mockGetTaskById).toHaveBeenCalledWith('task-1')
    expect(wrapper.text()).toContain('Task ID')
    expect(wrapper.text()).toContain('celery-1')
    expect(wrapper.text()).toContain('hello from the worker')
    expect(wrapper.text()).toContain('1 entries')
  })

  it('öffnet den Delete-Dialog und löst den Lösch-Flow aus', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const deleteButton = wrapper.find('[data-testid="btn-delete-deployment"]')
    expect(deleteButton.exists()).toBe(true)
    await deleteButton.trigger('click')
    await nextTick()

    expect(wrapper.find('.modal').exists()).toBe(true)

    const confirmButton = wrapper.find('[data-testid="btn-confirm-delete"]')
    expect(confirmButton.exists()).toBe(true)

    await confirmButton.trigger('click')
    await flushPromises()

    expect(mocks.mockDeleteDeployment).toHaveBeenCalledWith('dep-1')
    expect(mocks.mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'DeploymentDetailView.deleteSuccessToast',
    })
    expect(mocks.mockPush).toHaveBeenCalledWith({ name: 'deployments.list' })
  })
})

// ---------------------------------------------------------
// Pods: workloads instead of VMs
// ---------------------------------------------------------
describe('DeploymentDetailView.vue — Pods', () => {
  beforeEach(() => {
    serve(podDeployment())
    mocks.mockListResources.mockResolvedValue({ data: { resources: [], workloads: [workload()], live: true } })
  })

  it('zeigt die Workloads statt der VM-Infrastruktur', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('[data-testid="deployment-runtime"]').text()).toBe('runtime.kubernetes')
    expect(wrapper.find('[data-testid="pod-workloads"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="workload-team-alpha"]').text()).toContain('Team Alpha')
    expect(wrapper.findComponent(DeploymentInfrastructurePanel).exists()).toBe(false)
  })

  it('startet einen Workload neu und lädt danach den Stand', async () => {
    const wrapper = mountComponent()
    await flushPromises()
    mocks.mockFetchDeploymentById.mockClear()

    await wrapper.find('[data-testid="restart-team-alpha"]').trigger('click')
    await flushPromises()

    expect(mocks.mockRestartWorkload).toHaveBeenCalledWith('dep-1', 'team-alpha')
    expect(mocks.mockResetWorkload).not.toHaveBeenCalled()
    expect(mocks.mockToastSuccess).toHaveBeenCalledWith('pods.restartStarted')
    expect(mocks.mockFetchDeploymentById).toHaveBeenCalledWith('dep-1')
  })

  it('setzt einen Workload erst nach Bestätigung zurück (seine Daten werden gelöscht)', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-testid="reset-team-alpha"]').trigger('click')
    await nextTick()

    expect(mocks.mockResetWorkload).not.toHaveBeenCalled()
    expect(wrapper.find('.modal').text()).toContain('pods.confirmResetMessage')
    expect(wrapper.find('.modal').text()).toContain('team-alpha')

    await wrapper.find('[data-testid="btn-confirm-reset"]').trigger('click')
    await flushPromises()

    expect(mocks.mockResetWorkload).toHaveBeenCalledWith('dep-1', 'team-alpha')
  })

  it('bietet ohne erlaubten Redeploy weder Neustart noch Zurücksetzen an', async () => {
    serve(podDeployment({ status: 'paused', actions: ['resume', 'destroy'] }))

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('[data-testid="workload-team-alpha"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="restart-team-alpha"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reset-team-alpha"]').exists()).toBe(false)
  })

  it('meldet einen gerade laufenden Vorgang (409 ohne Grund)', async () => {
    mocks.mockRestartWorkload.mockRejectedValue({ response: { status: 409, data: { detail: 'busy' } } })
    const wrapper = mountComponent()
    await flushPromises()

    await wrapper.find('[data-testid="restart-team-alpha"]').trigger('click')
    await flushPromises()

    expect(mocks.mockToastError).toHaveBeenCalledWith('DeploymentDetailView.lifecycleBusy')
    // The button is usable again afterwards.
    expect(wrapper.find('[data-testid="restart-team-alpha"]').attributes('disabled')).toBeUndefined()
  })
})

// ---------------------------------------------------------
// Member self-access (own credentials via /my-access)
// ---------------------------------------------------------
describe('DeploymentDetailView.vue — member self-access', () => {
  beforeEach(() => {
    // A member of Team Alpha without owner view.
    mockAuthUserId.value = 'member-1'
    serve(baseDeployment({ permissions: MEMBER, actions: [] }))
    mocks.mockListTasksByDeployment.mockResolvedValue({ data: [] })
    mocks.mockGetMyAccess.mockResolvedValue({
      data: {
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
    const wrapper = mountComponent()
    await flushPromises()

    expect(mocks.mockGetMyAccess).toHaveBeenCalledWith('dep-1')
    expect(mocks.mockListTasksByDeployment).not.toHaveBeenCalled()
    expect(mocks.mockListResources).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="member-member-1"]').text()).toContain('member1')
  })

  it('hängt die Zugangsdaten nur an die eigene Zeile, nie an Teammitglieder', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('[data-testid="member-member-1"]').text()).toContain('PW:')
    expect(wrapper.find('[data-testid="member-member-2"]').text()).not.toContain('PW:')
    // The password stays hidden until asked for.
    expect(wrapper.text()).not.toContain('super-secret-pw')
  })

  it('ordnet über die Nutzer-ID zu, nicht über den Namen des Kontos', async () => {
    // The caller is member-2; the account key looks like member-1's.
    mockAuthUserId.value = 'member-2'

    const wrapper = mountComponent()
    await flushPromises()

    expect(wrapper.find('[data-testid="member-member-2"]').text()).toContain('PW:')
    expect(wrapper.find('[data-testid="member-member-1"]').text()).not.toContain('PW:')
  })

  it('zeigt bei Pods den eigenen Link zur App', async () => {
    serve(podDeployment({ permissions: MEMBER, actions: [] }))
    mocks.mockGetMyAccess.mockResolvedValue({
      data: {
        user_accounts: {
          'u-member-1': { user_id: 'member-1', workload: 'u-abc', url: 'https://lab.example/u-abc/', type: 'none' },
        },
        team_vms: {},
      },
    })

    const wrapper = mountComponent()
    await flushPromises()

    const link = wrapper.find('[data-testid="member-member-1"] a')
    expect(link.attributes('href')).toBe('https://lab.example/u-abc/')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('verlinkt keine Skript-URL aus den Outputs einer App', async () => {
    // A VM app's outputs come from its author's OpenTofu code: a crafted
    // "url" must not become a link that runs script in the AppStore.
    mocks.mockGetMyAccess.mockResolvedValue({
      data: {
        user_accounts: {
          'Team Alpha-member1': { username: 'member1', team: 'Team Alpha', type: 'none', url: 'javascript:alert(document.domain)' },
        },
        team_vms: { 'Team Alpha': { url: 'javascript:alert(1)' } },
      },
    })

    const wrapper = mountComponent()
    await flushPromises()

    const hrefs = wrapper.findAll('a').map((a) => a.attributes('href') ?? '')
    expect(hrefs.some((h) => h.toLowerCase().startsWith('javascript:'))).toBe(false)
  })

  it('ruft /my-access NICHT auf, wenn der Nutzer in keinem Team ist', async () => {
    serve(baseDeployment({ permissions: OWNER }))
    mockAuthUserId.value = 'user-owner'

    mountComponent()
    await flushPromises()

    expect(mocks.mockGetMyAccess).not.toHaveBeenCalled()
  })

  it('auch der Owner bekommt seine Zugangsdaten, wenn er selbst in einem Team ist', async () => {
    serve(baseDeployment({ permissions: { owner_view: true, operate: true, member: true } }))

    mountComponent()
    await flushPromises()

    expect(mocks.mockGetMyAccess).toHaveBeenCalledWith('dep-1')
    expect(mocks.mockListTasksByDeployment).toHaveBeenCalledWith('dep-1')
  })
})
