import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref, computed } from 'vue'

import DeploymentDetailView from '@/views/DeploymentDetailView.vue'
import type { DeploymentWithRelations, Task } from '@/types'

// ---------------------------------------------------------
// 1. Mocks & Setup
// ---------------------------------------------------------

const mocks = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockFetchDeploymentById: vi.fn(),
  mockDeleteDeployment: vi.fn(),
  mockListTasksByDeployment: vi.fn(),
  mockGetTaskById: vi.fn(),
  mockGetMyAccess: vi.fn(),
  mockAddToast: vi.fn(),
  mockStartStream: vi.fn(),
  mockStopStream: vi.fn(),
}))

const mockDeployment = ref<DeploymentWithRelations | null>(null)
const mockAuthUserId = ref('user-owner')
const mockIsTeacherOrAdmin = ref(true)

const mockStreamProgress = ref<number | null>(null)
const mockStreamCurrentPhase = ref<string | null>(null)
const mockStreamCurrentPhaseIndex = ref<number | null>(null)
const mockStreamTotalPhases = ref(11)
const mockStreamLiveLogs = ref([])
const mockStreamTotalLogCount = ref(0)
const mockStreamConnectionState = ref<'idle' | 'connecting' | 'live' | 'reconnecting' | 'ended' | 'error'>('idle')
const mockStreamPhaseNames = ref<string[]>([])

vi.mock('lucide-vue-next', () => {
  const icon = (className: string) => ({ template: `<span class="${className}" />` })

  // Every icon the view imports must be a named export here — vitest
  // validates named ESM imports at module-eval time, so a Proxy
  // fallback isn't enough. Keep this list in sync with the two
  // ``lucide-vue-next`` imports in DeploymentDetailView.vue.
  const names = [
    'CircleArrowLeft', 'Loader2', 'Users', 'Settings', 'Terminal',
    'ChevronDown', 'Trash2', 'GitBranch', 'User', 'Calendar', 'Clock',
    'Package', 'AlertCircle', 'CheckCircle', 'XCircle', 'StopCircle',
    'Flame', 'Copy', 'Check', 'Send', 'PauseCircle', 'PlayCircle',
    'RefreshCw', 'Server', 'Network', 'Shield', 'Eye', 'EyeOff',
  ]
  return Object.fromEntries(
    names.map((n) => [n, icon(`icon-${n.toLowerCase()}`)]),
  )
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'dep-1' } }),
  useRouter: () => ({ push: mocks.mockPush }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/stores/deployment.store', () => ({
  useDeploymentStore: () => ({
    get currentDeployment() {
      return mockDeployment.value
    },
    fetchDeploymentById: mocks.mockFetchDeploymentById,
    deleteDeployment: mocks.mockDeleteDeployment,
  }),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    get isTeacherOrAdmin() {
      return mockIsTeacherOrAdmin.value
    },
    get userId() {
      return mockAuthUserId.value
    },
  }),
}))

// ``useRole`` reads ``auth.user?.role`` in production; the auth-store
// mock above doesn't expose ``user``, so mock the composable directly
// and drive ``isStaff`` off the same ref the tests already toggle.
vi.mock('@/composables/useRole', () => ({
  useRole: () => ({
    isStaff: computed(() => mockIsTeacherOrAdmin.value),
  }),
}))

vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    addToast: mocks.mockAddToast,
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
    resendAccess: vi.fn(),
    getMyAccess: mocks.mockGetMyAccess,
    listResources: vi.fn().mockResolvedValue({ data: { resources: [] } }),
    redeployResource: vi.fn(),
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
        {
          userId: 'member-1',
          username: 'member.one',
          email: 'member1@example.com',
        },
      ],
    },
  ],
  outputs: null,
  logs: null,
  latest_task: null,
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
  tf_state: { resources: [{ name: 'vm-1' }] },
  outputs: { url: 'https://example.org' },
  current_phase: 'OUTPUTS_AND_CLEANUP',
  progress_pct: 100,
  created_at: '2026-06-08T12:09:00Z',
  ...overrides,
})

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

// Updated for the rebuilt view: Infrastructure panel, MarkdownRenderer,
// drawer wrapper, new failure-headline split in the log viewer.
describe('DeploymentDetailView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockDeployment.value = null
    mockAuthUserId.value = 'user-owner'
    mockIsTeacherOrAdmin.value = true

    mockStreamProgress.value = null
    mockStreamCurrentPhase.value = null
    mockStreamCurrentPhaseIndex.value = null
    mockStreamTotalPhases.value = 11
    mockStreamPhaseNames.value = []
    mockStreamLiveLogs.value = []
    mockStreamTotalLogCount.value = 0
    mockStreamConnectionState.value = 'idle'

    mocks.mockFetchDeploymentById.mockImplementation(async () => {
      mockDeployment.value = baseDeployment()
      return { data: mockDeployment.value }
    })

    mocks.mockDeleteDeployment.mockResolvedValue({ status: 204 })
    mocks.mockListTasksByDeployment.mockResolvedValue({ data: [baseTask()] })
    mocks.mockGetTaskById.mockResolvedValue({ data: baseTask() })
    mocks.mockGetMyAccess.mockResolvedValue({ data: { user_accounts: null, team_vms: null } })
  })

  const mountComponent = () =>
    mount(DeploymentDetailView, {
      global: {
        mocks: {
          $t: (key: string, vars?: Record<string, unknown>) =>
            vars ? `${key} ${JSON.stringify(vars)}` : key,
        },
        stubs: {
          RouterLink: true,
          BaseButton: { template: '<button><slot /></button>' },
          Modal: {
            props: ['show'],
            template: `<div v-if="$props.show" class="modal">
              <slot name="title" />
              <slot name="body" />
              <slot name="footer" />
            </div>`,
          },
          // New components added in the infrastructure / markdown refactor.
          InfrastructureVmCard: { template: '<div class="vm-card-stub" />' },
          InfrastructureVmDrawer: { template: '<div class="vm-drawer-stub" />' },
          MarkdownRenderer: {
            props: ['source'],
            template: '<div class="markdown-stub">{{ source }}</div>',
          },
        },
      },
    })

  // --- 1. Lifecycle & Datenladen ---

  it('lädt Deployment und Tasks beim Öffnen der Detailseite', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    expect(mocks.mockFetchDeploymentById).toHaveBeenCalledWith('dep-1')
    expect(mocks.mockListTasksByDeployment).toHaveBeenCalledWith('dep-1')
    expect(wrapper.text()).toContain('Data Lab')
    expect(wrapper.text()).toContain('Notebook Stack')
    expect(wrapper.text()).toContain('owner@example.com')
  })

  // --- 2. Gruppen, Variablen und Teams ---

  it('zeigt Gruppen-, Variablen- und Teamdaten aus dem Deployment', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // Groups section: group card renders the name.
    expect(wrapper.text()).toContain('Group A')
    // Teams & Members section.
    expect(wrapper.text()).toContain('Team Alpha')
    expect(wrapper.text()).toContain('member.one')
    // Variables: comment stripped by cleanVariableValue().
    expect(wrapper.text()).toContain('ubuntu:22.04')
    expect(wrapper.text()).not.toContain('# default image')

    // Clicking a group card navigates to the student list.
    const groupCard = wrapper.findAll('div.cursor-pointer')
      .find(el => el.text().includes('Group A'))
    expect(groupCard).toBeTruthy()
    await groupCard!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('student-1')
    expect(wrapper.text()).toContain('student-2')
  })

  // --- 3. Rollen- und Sichtbarkeitslogik ---

  it('blendet Tasks und Löschaktion für Nicht-Besitzer aus', async () => {
    mockIsTeacherOrAdmin.value = false
    mockAuthUserId.value = 'student-1'
    // Deployment is owned by someone else → isOwnerView = false.
    mockDeployment.value = baseDeployment({ userId: 'user-owner' })

    const wrapper = mountComponent()
    await flushPromises()

    // Owner-only task list endpoint must NOT be called.
    expect(mocks.mockListTasksByDeployment).not.toHaveBeenCalled()
    // Placeholder "owner only" message is shown instead of the task list.
    expect(wrapper.text()).toContain('DeploymentDetailView.tasksOwnerOnly')
    // Delete button is hidden entirely for non-owners.
    expect(wrapper.text()).not.toContain('DeploymentDetailView.deploymentDelete')
  })

  // --- 4. Task-Details öffnen ---

  it('lädt und zeigt Task-Details, wenn ein Task aus der Liste geöffnet wird', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    // Find the task row in the history list. Note: findAll('div.cursor-pointer')
    // would also match group cards whose i18n key "deploymentStudentCount"
    // contains "deploy" as a substring, so use the task-list container instead.
    const taskRow = wrapper.find('.space-y-2 div.cursor-pointer')
    expect(taskRow).toBeTruthy()

    await taskRow!.trigger('click')
    await flushPromises()
    await nextTick()

    expect(mocks.mockGetTaskById).toHaveBeenCalledWith('task-1')
    // Task metadata panel.
    expect(wrapper.text()).toContain('Task ID')
    expect(wrapper.text()).toContain('celery-1')
    // Log content rendered via prettyJson / highlightJson.
    expect(wrapper.text()).toContain('hello from the worker')
    // logEntryCount badge: logs.logs has 1 entry.
    expect(wrapper.text()).toContain('1 entries')
  })

  // --- 5. Delete-Flow ---

  it('öffnet den Delete-Dialog und löst den Lösch-Flow aus', async () => {
    const wrapper = mountComponent()
    await flushPromises()

    const deleteButton = wrapper.findAll('button')
      .find(b => b.text().includes('DeploymentDetailView.deploymentDelete'))
    expect(deleteButton).toBeTruthy()

    await deleteButton!.trigger('click')
    await nextTick()

    // Modal is now open.
    expect(wrapper.find('.modal').exists()).toBe(true)

    // Confirm button lives inside the modal's #footer slot.
    const confirmButton = wrapper.findAll('.modal button')
      .find(b => b.text().includes('DeploymentDetailView.confirmButton'))
    expect(confirmButton).toBeTruthy()

    await confirmButton!.trigger('click')
    await flushPromises()

    expect(mocks.mockDeleteDeployment).toHaveBeenCalledWith('dep-1')
    // 204 → soft-delete, success toast + redirect.
    expect(mocks.mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      message: 'DeploymentDetailView.deleteSuccessToast',
    })
    expect(mocks.mockPush).toHaveBeenCalledWith({ name: 'deployments.list' })
  })
})


// ---------------------------------------------------------
// Member self-access (own credentials via /my-access)
// ---------------------------------------------------------
// Focused, un-skipped block: unlike the legacy suite above (skipped
// pending a full rewrite), this covers only the member self-credentials
// path added alongside the backend ``/my-access`` endpoint.
describe('DeploymentDetailView.vue — member self-access', () => {
  const mountComponent = () =>
    mount(DeploymentDetailView, {
      global: {
        mocks: {
          $t: (key: string, vars?: Record<string, unknown>) =>
            vars ? `${key} ${JSON.stringify(vars)}` : key,
        },
        stubs: {
          RouterLink: true,
          BaseButton: { template: '<button><slot /></button>' },
          Modal: {
            props: ['show'],
            template: '<div v-if="$props.show" class="modal"><slot /></div>',
          },
        },
      },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    // Non-owner student who IS a member of Team Alpha (member-1).
    mockIsTeacherOrAdmin.value = false
    mockAuthUserId.value = 'member-1'
    mockDeployment.value = baseDeployment({ userId: 'user-owner' })
    mocks.mockListTasksByDeployment.mockResolvedValue({ data: [] })
    mocks.mockGetMyAccess.mockResolvedValue({
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
    const wrapper = mountComponent()
    await flushPromises()

    // Member path: my-access is queried, the owner-only task list is not.
    expect(mocks.mockGetMyAccess).toHaveBeenCalledWith('dep-1')
    expect(mocks.mockListTasksByDeployment).not.toHaveBeenCalled()
    // The own credential renders in the Teams card.
    expect(wrapper.text()).toContain('member1')
  })

  it('ruft /my-access NICHT auf, wenn der Nutzer Owner-View hat', async () => {
    // Staff → owner view → task-based outputs path, no my-access call.
    mockIsTeacherOrAdmin.value = true
    mocks.mockGetMyAccess.mockClear()

    mountComponent()
    await flushPromises()

    expect(mocks.mockGetMyAccess).not.toHaveBeenCalled()
  })
})