import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useRouter } from 'vue-router'

import DeploymentSummary from '@/views/NewDeploymentSummaryView.vue'

import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { useToastStore } from '@/stores/toast.store'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'

// --- MOCKS ---
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn()
  }))
}))

// Placeholders are appended so the tests see what a message is built from.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key)
  })
}))

vi.mock('@/composables/useOpenStackResourceCache', () => ({
  ensureLoaded: vi.fn().mockResolvedValue(undefined),
  getDisplayName: vi.fn((_type, _mode, val) => ({ name: `OS-Name-${val}` })),
  setCredential: vi.fn()
}))

interface WrapperOptions {
  runtime?: 'kubernetes' | 'openstack-vm'
  credentialId?: string | null
  credentials?: unknown[] | null
}

describe('NewDeploymentSummaryView.vue', () => {
  let routerPushMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    routerPushMock = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ push: routerPushMock } as any)
  })

  function createWrapper({ runtime = 'kubernetes', credentialId = null, credentials = [] }: WrapperOptions = {}) {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        app: {
          apps: [
            { appId: 'app-1', name: 'Test App', image: 'test.png' }
          ]
        },
        // The wizard keys everyone by the AppStore user id (what the teams carry).
        deployment: {
          studentCache: new Map([
            ['u1', { userId: 'u1', firstName: 'John', lastName: 'Doe' }]
          ]),
          draft: {
            name: 'My Deployment',
            appId: 'app-1',
            releaseTag: '1.0.0',
            runtime,
            scope: runtime === 'kubernetes' ? 'team' : 'user',
            credentialId,
            groupCount: 1,
            groupMode: 'one',
            studentIds: ['u1'],
            assignments: {
              0: ['u1']
            },
            groupNames: ['Team Alpha'],
            variables: {
              'region': 'eu-central-1',
              'instance_type': 't2.micro'
            },
            fileUploads: {
              'ssh_key': {
                'u1': { name: 'id_rsa.pub', size: 1024 } // 1 KB
              }
            },
            variableDefinitions: []
          }
        },
        'openstack-credentials': { credentials }
      }
    })

    const appStore = useAppStore()
    appStore.fetchAppVariables = vi.fn().mockResolvedValue([
      { name: 'region', source: 'packer', default: 'us-east' },
      { name: 'instance_type', source: 'terraform', default: 't2.small' },
      { name: 'ssh_key', source: 'terraform', osType: 'file', osScope: 'user' }
    ])

    const deploymentStore = useDeploymentStore()
    deploymentStore.submitDraft = vi.fn().mockResolvedValue({ deploymentId: 'dep-123' })
    deploymentStore.resetDraft = vi.fn()

    return mount(DeploymentSummary, {
      global: {
        plugins: [pinia],
        stubs: {
          DeploymentProgressBar: true,
          BarChart3: true,
          ArrowRight: true,
          ArrowLeft: true,
          Box: true,
          Layers: true
        }
      }
    })
  }

  async function submitWith(error: unknown) {
    const wrapper = createWrapper()
    await flushPromises()
    const deploymentStore = useDeploymentStore()
    deploymentStore.submitDraft = vi.fn().mockRejectedValue(error)

    const deployBtn = wrapper.findAll('button').find(b => b.text().includes('deployment.actions.deploy'))
    await deployBtn?.trigger('click')
    await flushPromises()
    return useToastStore()
  }

  it('loads variables on mount and displays summary config', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const appStore = useAppStore()
    expect(appStore.fetchAppVariables).toHaveBeenCalledWith('app-1', '1.0.0')

    expect(wrapper.text()).toContain('My Deployment')
    expect(wrapper.text()).toContain('Test App')
    expect(wrapper.text()).toContain('1.0.0')
    expect(wrapper.text()).toContain('John Doe')
    expect(wrapper.text()).toContain('Team Alpha')
  })

  it('a VM app lists Packer and Terraform variables and the uploaded files', async () => {
    const wrapper = createWrapper({ runtime: 'openstack-vm' })
    await flushPromises()

    expect(wrapper.text()).toContain('deployment.summary.packerVars')
    expect(wrapper.text()).toContain('eu-central-1')
    expect(wrapper.text()).toContain('deployment.summary.terraformVars')
    expect(wrapper.text()).toContain('t2.micro')
    expect(wrapper.text()).toContain('id_rsa.pub')
    expect(wrapper.text()).toContain('1 KB')
  })

  it('a pod app shows its settings and files, without a Packer card', async () => {
    const wrapper = createWrapper({ runtime: 'kubernetes' })
    await flushPromises()

    expect(wrapper.text()).not.toContain('deployment.summary.packerVars')
    expect(wrapper.text()).toContain('deployment.summary.appSettings')
    expect(wrapper.text()).toContain('t2.micro')
    expect(wrapper.text()).toContain('id_rsa.pub')
  })

  describe('runtime and project', () => {
    it('a pod app runs in the cluster: no project, no credential lookup', async () => {
      const wrapper = createWrapper({ runtime: 'kubernetes', credentials: null })
      await flushPromises()

      const card = wrapper.find('[data-testid="summary-runtime"]')
      expect(card.text()).toContain('runtime.kubernetes')
      expect(card.text()).not.toContain('deployment.summary.projectLabel')
      expect(useOpenStackCredentialsStore().fetch).not.toHaveBeenCalled()
    })

    it('a VM app names the OpenStack project of the chosen credential', async () => {
      const wrapper = createWrapper({
        runtime: 'openstack-vm',
        credentialId: 'c-1',
        credentials: [{ credentialId: 'c-1', project_id: 'p-1', project_name: 'Lab Project', project_verified: true }]
      })
      await flushPromises()

      const card = wrapper.find('[data-testid="summary-runtime"]')
      expect(card.text()).toContain('runtime.openstackVm')
      expect(card.text()).toContain('Lab Project')
    })

    it('a VM app loads the credentials after a reload', async () => {
      createWrapper({ runtime: 'openstack-vm', credentialId: 'c-1', credentials: null })
      await flushPromises()

      expect(useOpenStackCredentialsStore().fetch).toHaveBeenCalledTimes(1)
    })
  })

  it('navigates back to variables step when Back or Edit button is clicked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const backBtn = wrapper.findAll('button').find(b => b.text().includes('deployment.actions.back'))
    await backBtn?.trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployment.variables' })

    const editBtn = wrapper.findAll('button').find(b => b.text().includes('deployment.summary.editBtn'))
    await editBtn?.trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployment.variables' })
  })

  it('submits the draft as it is (user ids need no translation) and redirects on success', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const deploymentStore = useDeploymentStore()
    const toastStore = useToastStore()

    const deployBtn = wrapper.findAll('button').find(b => b.text().includes('deployment.actions.deploy'))
    await deployBtn?.trigger('click')
    await flushPromises()

    expect(deploymentStore.draft.studentIds).toEqual(['u1'])
    expect((deploymentStore.draft.assignments as any)[0]).toEqual(['u1'])
    expect(deploymentStore.submitDraft).toHaveBeenCalledTimes(1)
    expect(deploymentStore.resetDraft).toHaveBeenCalled()
    expect(toastStore.addToast).toHaveBeenCalledWith({
      message: 'deployment.summary.submitSuccess',
      type: 'success'
    })
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployments.list' })
  })

  describe('submit errors', () => {
    it('a file over the limit names the file and both sizes', async () => {
      const toastStore = await submitWith({
        response: {
          data: {
            detail: { reason: 'file_too_large', filename: 'test.zip', actual_bytes: 3145728, limit_bytes: 2097152 }
          }
        }
      })

      expect(toastStore.addToast).toHaveBeenCalledWith({
        message: 'deployment.summary.errors.fileTooLarge {"filename":"test.zip","actualMb":"3.0","limitMb":"2.0"}',
        type: 'error'
      })
      expect(routerPushMock).not.toHaveBeenCalledWith({ name: 'deployments.list' })
    })

    it('an unapproved version (approval pinned to another commit) gets its own message', async () => {
      const toastStore = await submitWith({ response: { status: 409, data: { detail: { code: 'version_not_approved' } } } })

      expect(toastStore.addToast).toHaveBeenCalledWith({
        message: 'deployment.summary.errors.version_not_approved',
        type: 'error'
      })
    })

    it('the workload budget names what is in use, requested and allowed', async () => {
      const toastStore = await submitWith({
        response: { status: 409, data: { detail: { reason: 'workload_budget_exceeded', in_use: 40, requested: 12, budget: 48 } } }
      })

      expect(toastStore.addToast).toHaveBeenCalledWith({
        message: 'deployment.summary.errors.workload_budget_exceeded {"inUse":40,"requested":12,"budget":48}',
        type: 'error'
      })
    })

    it('an unverified credential gets its own message', async () => {
      const toastStore = await submitWith({
        response: { status: 422, data: { detail: { reason: 'openstack_credentials_unverified' } } }
      })

      expect(toastStore.addToast).toHaveBeenCalledWith({
        message: 'deployment.summary.errors.openstack_credentials_unverified {"limit":"","workloads":""}',
        type: 'error'
      })
    })

    it('an unknown reason falls back to the generic message, never "[object Object]"', async () => {
      const toastStore = await submitWith({ response: { data: { detail: { reason: 'something_new' } } } })

      expect(toastStore.addToast).toHaveBeenCalledWith({
        message: 'deployment.summary.submitError',
        type: 'error'
      })
    })
  })
})
