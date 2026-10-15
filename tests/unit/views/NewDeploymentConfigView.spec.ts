import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useRouter } from 'vue-router'

import DeploymentConfig from '@/views/NewDeploymentConfigView.vue'

import { useDeploymentStore } from '@/stores/deployment.store'
import { appApi } from '@/api/app.api'
import { courseApi } from '@/api/course.api'
import { userApi } from '@/api/user.api'
import { useToast } from '@/composables/useToast'

// --- MOCKS ---
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn()
  }))
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => ({
    warning: vi.fn(),
    error: vi.fn(),
    clear: vi.fn(),
    success: vi.fn()
  }))
}))

vi.mock('@/api/app.api', () => ({
  appApi: {
    getRuntime: vi.fn()
  }
}))

vi.mock('@/api/course.api', () => ({
  courseApi: {
    list: vi.fn(),
    getById: vi.fn()
  }
}))

vi.mock('@/api/user.api', () => ({
  userApi: {
    list: vi.fn(),
    search: vi.fn()
  }
}))

// A credential as GET /me/openstack-credentials lists it (one per project).
function credential(id: string, overrides: Record<string, unknown> = {}) {
  return {
    credentialId: id,
    auth_type: 'v3applicationcredential',
    auth_url: 'https://keystone.example/v3',
    project_id: `p-${id}`,
    project_name: `Project ${id}`,
    project_verified: true,
    last_validated_at: '2026-10-15T08:00:00Z',
    last_validation_error: null,
    active_deployments: 0,
    ...overrides
  }
}

interface WrapperOptions {
  runtime?: 'kubernetes' | 'openstack-vm' | null
  releaseTag?: string
  credentials?: ReturnType<typeof credential>[] | null
}

describe('NewDeploymentConfigView.vue', () => {
  let routerPushMock: any
  let toastWarningMock: any
  let toastErrorMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    routerPushMock = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push: routerPushMock } as any)

    toastWarningMock = vi.fn()
    toastErrorMock = vi.fn()
    vi.mocked(useToast).mockReturnValue({
      warning: toastWarningMock,
      error: toastErrorMock,
      clear: vi.fn(),
      success: vi.fn()
    } as any)

    vi.mocked(courseApi.list).mockResolvedValue({ data: [{ courseId: 'c1', name: 'Web Dev' }] } as any)
    // Students are keyed by the AppStore user id; LTI users have no Keycloak id.
    vi.mocked(userApi.list).mockResolvedValue({ data: [{ userId: 'u1', firstName: 'John', lastName: 'Doe' }] } as any)
    vi.mocked(courseApi.getById).mockResolvedValue({ data: { users: [] } } as any)
  })

  function createWrapper({ runtime = 'kubernetes', releaseTag = 'v1.0', credentials = [] }: WrapperOptions = {}) {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        deployment: {
          draft: {
            name: '',
            appId: 'app-1',
            releaseTag,
            runtime,
            scope: runtime === 'kubernetes' ? 'team' : runtime ? 'user' : null,
            credentialId: null,
            studentIds: [],
            courseIds: []
          },
          studentCache: new Map()
        },
        // `null` = not loaded yet; the real getters derive usable/unverified.
        'openstack-credentials': { credentials }
      }
    })

    return mount(DeploymentConfig, {
      global: {
        plugins: [pinia],
        stubs: {
          DeploymentProgressBar: true,
          CredentialMissingBanner: true,
          BarChart3: true,
          Search: true,
          Check: true,
          Users: true,
          BookOpen: true,
          UserPlus: true
        }
      }
    })
  }

  it('renders correctly and loads courses & students on mount', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    expect(courseApi.list).toHaveBeenCalledWith(0, 200)
    expect(userApi.list).toHaveBeenCalledWith({ role: 'student', limit: 1000 })
    expect(wrapper.text()).toContain('Web Dev')
  })

  describe('runtime and OpenStack project', () => {
    it('a pod app needs no credential: no picker, no banner, the form is shown', async () => {
      const wrapper = createWrapper({ runtime: 'kubernetes', credentials: [] })
      await flushPromises()

      expect(wrapper.find('[data-testid="credential-picker"]').exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'CredentialMissingBanner' }).exists()).toBe(false)
      expect(wrapper.find('[data-testid="deployment-name"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="btn-next"]').attributes('disabled')).toBeUndefined()
    })

    it('a VM app without a usable credential shows the banner and hides the form', async () => {
      // Only an unverified (typed-in project) credential: does not count.
      const wrapper = createWrapper({
        runtime: 'openstack-vm',
        credentials: [credential('c-1', { project_verified: false })]
      })
      await flushPromises()

      expect(wrapper.findComponent({ name: 'CredentialMissingBanner' }).exists()).toBe(true)
      expect(wrapper.find('[data-testid="deployment-name"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="btn-next"]').attributes('disabled')).toBeDefined()
    })

    it('a VM app picks the only usable credential by default', async () => {
      const wrapper = createWrapper({
        runtime: 'openstack-vm',
        credentials: [credential('c-1'), credential('c-2', { last_validation_error: 'invalid_credentials' })]
      })
      await flushPromises()

      const store = useDeploymentStore()
      expect(store.draft.credentialId).toBe('c-1')
      // Only usable credentials are offered (plus the disabled placeholder).
      const options = wrapper.find('[data-testid="deployment-credential"]').findAll('option')
      expect(options.map((o) => o.text())).toEqual(['deployment.config.credentialPlaceholder', 'Project c-1'])
    })

    it('a VM app with several usable credentials makes the teacher choose', async () => {
      const wrapper = createWrapper({ runtime: 'openstack-vm', credentials: [credential('c-1'), credential('c-2')] })
      await flushPromises()

      const store = useDeploymentStore()
      expect(store.draft.credentialId).toBeNull()
      store.draft.name = 'My Deployment'
      store.draft.studentIds = ['u1']

      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      expect(toastWarningMock).toHaveBeenCalledWith('deployment.config.credentialRequired')
      expect(routerPushMock).not.toHaveBeenCalled()

      await wrapper.find('[data-testid="deployment-credential"]').setValue('c-2')
      await wrapper.find('[data-testid="btn-next"]').trigger('click')
      expect(store.draft.credentialId).toBe('c-2')
      expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployment.teams' })
    })

    it('a pod app drops a credential left in the draft', async () => {
      createWrapper({ runtime: 'kubernetes', credentials: [credential('c-1')] })
      const store = useDeploymentStore()
      store.draft.credentialId = 'c-1'
      await flushPromises()

      expect(store.draft.credentialId).toBeNull()
    })

    it('a reload without the runtime in the draft asks the API again', async () => {
      vi.mocked(appApi.getRuntime).mockResolvedValue({ data: { runtime: 'openstack-vm', scope: 'user' } } as any)
      const wrapper = createWrapper({ runtime: null, releaseTag: 'v2.0', credentials: [credential('c-1')] })
      await flushPromises()

      const store = useDeploymentStore()
      expect(appApi.getRuntime).toHaveBeenCalledWith('app-1', 'v2.0')
      expect(store.draft.runtime).toBe('openstack-vm')
      expect(store.draft.scope).toBe('user')
      expect(wrapper.find('[data-testid="credential-picker"]').exists()).toBe(true)
    })

    it('a failing runtime lookup is reported', async () => {
      vi.mocked(appApi.getRuntime).mockRejectedValue(new Error('boom'))
      createWrapper({ runtime: null })
      await flushPromises()

      expect(toastErrorMock).toHaveBeenCalledWith('AppsDetailView.runtime.loadError')
    })
  })

  it('validates missing name when clicking next', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const store = useDeploymentStore()
    store.draft.name = ''
    store.draft.studentIds = ['u1']

    await wrapper.find('[data-testid="btn-next"]').trigger('click')

    expect(toastWarningMock).toHaveBeenCalledWith('deployment.errors.missingName')
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('validates missing students when clicking next', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const store = useDeploymentStore()
    store.draft.name = 'My Deployment'
    store.draft.studentIds = []

    await wrapper.find('[data-testid="btn-next"]').trigger('click')

    expect(toastWarningMock).toHaveBeenCalledWith('deployment.errors.missingStudents')
    expect(routerPushMock).not.toHaveBeenCalled()
  })

  it('proceeds to next step when valid', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const store = useDeploymentStore()
    store.draft.name = 'My Deployment'
    store.draft.studentIds = ['u1']

    await wrapper.find('[data-testid="btn-next"]').trigger('click')

    expect(toastWarningMock).not.toHaveBeenCalled()
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployment.teams' })
  })

  it('switches tabs and selects an individual student by user id', async () => {
    // Skip the 300 ms search debounce.
    vi.useFakeTimers()

    const wrapper = createWrapper()
    await flushPromises()

    const store = useDeploymentStore()

    const studentsTabBtn = wrapper.findAll('button').find(btn => btn.text().includes('deployment.config.studentsLabel'))
    await studentsTabBtn?.trigger('click')

    // A Moodle (LTI) user: no Keycloak id, but a user id like everyone.
    vi.mocked(userApi.search).mockResolvedValue({
      data: [{ userId: 'lti-7', firstName: 'Lena', lastName: 'Moodle', keycloak_id: null }]
    } as any)

    await wrapper.find('[data-testid="student-search"]').setValue('Lena')
    vi.advanceTimersByTime(300)
    await flushPromises()

    const studentDiv = wrapper.find('[data-testid="student-lti-7"]')
    expect(studentDiv.exists()).toBe(true)
    await studentDiv.trigger('click')

    expect(store.draft.studentIds).toEqual(['lti-7'])
    expect(store.studentCache.get('lti-7')?.firstName).toBe('Lena')

    vi.useRealTimers()
  })

  it('selecting a course adds all of its students by user id', async () => {
    vi.mocked(courseApi.getById).mockResolvedValue({
      data: { users: [{ userId: 'u1', firstName: 'John' }, { userId: 'lti-7', firstName: 'Lena' }] }
    } as any)
    const wrapper = createWrapper()
    await flushPromises()

    await wrapper.find('[data-testid="course-c1"]').trigger('click')
    await flushPromises()

    const store = useDeploymentStore()
    expect(store.draft.studentIds).toEqual(['u1', 'lti-7'])
    expect(store.draft.courseIds).toEqual(['c1'])
  })

  it('handles back button correctly', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const store = useDeploymentStore()
    store.draft.appId = 'app-123'

    await wrapper.find('[data-testid="btn-back"]').trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith({ name: 'apps.detail', params: { id: 'app-123' } })
  })
})
