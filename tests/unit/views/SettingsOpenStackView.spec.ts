import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import SettingsOpenStackView from '@/views/SettingsOpenStackView.vue'
import type { OpenStackCredential } from '@/types/openstack-credential'

// ---------------------------------------------------------------
// The view carries `data-testid` on its inputs, tabs, credential rows
// and action buttons. Those are a deliberate testing contract: they do
// not move when the layout or the translations do. Assertions are on
// the payload handed to the store and the i18n *key* passed to the
// toast, never on rendered German.
//
// One credential per OpenStack project: the page lists them, adds new
// ones (Keystone names the project) and checks or deletes each one.
// ---------------------------------------------------------------

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: any) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
  }),
}))

const mockPush = vi.fn()
let mockQuery: Record<string, unknown> = {}
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mockQuery }),
  useRouter: () => ({ push: mockPush }),
}))

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
const mockToastWarning = vi.fn()
vi.mock('@/stores/toast.store', () => ({
  useToastStore: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    warning: mockToastWarning,
  }),
}))

vi.mock('@/utils/clouds-yaml', () => ({
  parseCloudsYaml: vi.fn(),
  CloudsYamlError: class extends Error {},
}))
import { parseCloudsYaml } from '@/utils/clouds-yaml'

function credential(overrides: Partial<OpenStackCredential> = {}): OpenStackCredential {
  return {
    credentialId: 'c-1',
    auth_type: 'v3applicationcredential',
    auth_url: 'https://keystone.example/v3',
    project_id: 'p-1',
    project_name: 'Project One',
    project_verified: true,
    last_validated_at: '2026-10-15T08:00:00Z',
    last_validation_error: null,
    active_deployments: 0,
    ...overrides,
  }
}

const mockFetch = vi.fn()
const mockSave = vi.fn()
const mockTest = vi.fn()
const mockRemove = vi.fn()

let storeState = {
  loading: false,
  credentials: [] as OpenStackCredential[] | null,
  error: null as string | null,
}

vi.mock('@/stores/openstack-credentials.store', () => ({
  useOpenStackCredentialsStore: () => ({
    get loading() { return storeState.loading },
    get isResolved() { return storeState.credentials !== null },
    get hasAnyCredential() { return (storeState.credentials?.length ?? 0) > 0 },
    get list() { return storeState.credentials ?? [] },
    get error() { return storeState.error },
    fetch: mockFetch,
    save: mockSave,
    test: mockTest,
    remove: mockRemove,
  }),
}))

const originalConfirm = window.confirm
const mockConfirm = vi.fn()

const mountView = () =>
  mount(SettingsOpenStackView, {
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        PageHeader: { props: ['title'], template: '<h1>{{ title }}</h1>' },
        'i18n-t': { props: ['keypath'], template: '<span>{{ keypath }}<slot name="file" /></span>' },
      },
    },
  })

const field = (wrapper: any, id: string) => wrapper.get(`[data-testid="${id}"]`)

async function fillAppForm(wrapper: any) {
  await field(wrapper, 'app-auth-url').setValue('https://test.com')
  await field(wrapper, 'app-identifier').setValue('my-app-id')
  await field(wrapper, 'app-secret').setValue('my-secret-key')
}

describe('SettingsOpenStackView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm = mockConfirm
    mockQuery = {}
    storeState = { loading: false, credentials: [], error: null }
    mockSave.mockResolvedValue(credential())
  })

  afterEach(() => {
    window.confirm = originalConfirm
  })

  it('loads the credentials on mount', () => {
    mountView()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('without credentials explains that only VM apps need one', async () => {
    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('SettingsOpenStackView.vmOnlyHint')
    expect(wrapper.text()).toContain('SettingsOpenStackView.status.noneTitle')
  })

  // --- the list -----------------------------------------------------

  it('lists one row per project with its state', async () => {
    storeState.credentials = [
      credential(),
      credential({ credentialId: 'c-2', project_id: 'typed', project_name: null, project_verified: false }),
      credential({ credentialId: 'c-3', project_id: 'p-3', project_name: 'Project Three', last_validation_error: 'invalid_credentials' }),
    ]

    const wrapper = mountView()
    await flushPromises()

    expect(field(wrapper, 'credential-c-1').text()).toContain('Project One')
    expect(field(wrapper, 'credential-c-1').text()).toContain('SettingsOpenStackView.status.lastChecked')
    // Saved before projects were checked: must be checked once before use.
    expect(field(wrapper, 'credential-c-2').find('[data-testid="credential-unverified"]').exists()).toBe(true)
    expect(field(wrapper, 'credential-c-3').text()).toContain('invalid_credentials')
  })

  it('a credential with active deployments cannot be deleted', async () => {
    storeState.credentials = [
      credential({ active_deployments: 2 }),
      credential({ credentialId: 'c-2', project_id: 'p-2', project_name: 'Project Two' }),
    ]

    const wrapper = mountView()
    await flushPromises()

    const locked = field(wrapper, 'btn-delete-c-1')
    expect(locked.attributes('disabled')).toBeDefined()
    expect(locked.attributes('title')).toBe('SettingsOpenStackView.tooltips.lockedActiveDeployments')
    expect(field(wrapper, 'credential-c-1').text()).toContain('SettingsOpenStackView.status.activeDeployments {"count":2}')
    expect(field(wrapper, 'btn-delete-c-2').attributes('disabled')).toBeUndefined()
    // Adding a credential for another project stays possible.
    expect(field(wrapper, 'btn-save').attributes('disabled')).toBeUndefined()
  })

  // --- saving -------------------------------------------------------

  it('refuses to save with required fields missing and says why', async () => {
    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'btn-save').trigger('click')

    expect(mockSave).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith('SettingsOpenStackView.errors.missingFields')
  })

  it('saves an application credential and names the project Keystone reported', async () => {
    const wrapper = mountView()
    await flushPromises()

    await fillAppForm(wrapper)
    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect(mockSave).toHaveBeenCalledWith({
      auth_type: 'v3applicationcredential',
      auth_url: 'https://test.com',
      region_name: null,
      interface: 'public',
      identity_api_version: '3',
      identifier: 'my-app-id',
      secret: 'my-secret-key',
    })
    expect(mockToastSuccess).toHaveBeenCalledWith('SettingsOpenStackView.toasts.saveSuccess {"project":"Project One"}')
  })

  it('clears the identifier and secret from the form after a successful save', async () => {
    const wrapper = mountView()
    await flushPromises()

    await fillAppForm(wrapper)
    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect((field(wrapper, 'app-secret').element as HTMLInputElement).value).toBe('')
    expect((field(wrapper, 'app-identifier').element as HTMLInputElement).value).toBe('')
  })

  it('shows why Keystone rejected a credential and stores nothing', async () => {
    mockSave.mockImplementation(async () => {
      storeState.error = 'auth_url_not_allowed'
      throw new Error('422')
    })
    const wrapper = mountView()
    await flushPromises()

    await fillAppForm(wrapper)
    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect(mockToastError).toHaveBeenCalledWith('auth_url_not_allowed')
    expect(mockToastSuccess).not.toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('saves a password credential from the second tab', async () => {
    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'tab-password').trigger('click')
    await flushPromises()

    await field(wrapper, 'pwd-auth-url').setValue('https://pwd-cloud.com')
    await field(wrapper, 'pwd-user-domain').setValue('Default')
    await field(wrapper, 'pwd-identifier').setValue('admin')
    await field(wrapper, 'pwd-project-id').setValue('project-123')
    await field(wrapper, 'pwd-secret').setValue('super-secret')
    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect(mockSave).toHaveBeenCalledWith({
      auth_type: 'password',
      auth_url: 'https://pwd-cloud.com',
      region_name: null,
      interface: 'public',
      identity_api_version: '3',
      identifier: 'admin',
      secret: 'super-secret',
      project_id: 'project-123',
      project_name: null,
      user_domain_name: 'Default',
      project_domain_name: null,
    })
  })

  it('requires a project id or name before saving a password credential', async () => {
    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'tab-password').trigger('click')
    await flushPromises()

    // Everything except a project reference.
    await field(wrapper, 'pwd-auth-url').setValue('https://pwd-cloud.com')
    await field(wrapper, 'pwd-user-domain').setValue('Default')
    await field(wrapper, 'pwd-identifier').setValue('admin')
    await field(wrapper, 'pwd-secret').setValue('super-secret')
    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect(mockSave).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith('SettingsOpenStackView.errors.missingFields')
  })

  // --- back to the wizard -------------------------------------------

  it('returns to the wizard step that sent the user here', async () => {
    mockQuery = { next: '/deployment/new/config' }
    const wrapper = mountView()
    await flushPromises()

    await fillAppForm(wrapper)
    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect(mockPush).toHaveBeenCalledWith('/deployment/new/config')
  })

  it.each([
    ['https://evil.example/phish'],
    ['//evil.example/phish'],
    ['/\\evil.example/phish'],
    ['javascript:alert(1)'],
  ])('never follows a return target outside the app (%s)', async (next) => {
    mockQuery = { next }
    const wrapper = mountView()
    await flushPromises()

    await fillAppForm(wrapper)
    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect(mockSave).toHaveBeenCalled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  // --- check --------------------------------------------------------

  it('re-checks a credential and reports a pass', async () => {
    storeState.credentials = [credential()]
    mockTest.mockResolvedValue(credential())

    const wrapper = mountView()
    await flushPromises()
    await field(wrapper, 'btn-retest-c-1').trigger('click')
    await flushPromises()

    expect(mockTest).toHaveBeenCalledWith('c-1')
    expect(mockToastSuccess).toHaveBeenCalledWith('SettingsOpenStackView.toasts.credentialsValid')
  })

  it('re-checks a credential and reports what Keystone said', async () => {
    storeState.credentials = [credential()]
    mockTest.mockResolvedValue(credential({ last_validation_error: 'invalid_credentials' }))

    const wrapper = mountView()
    await flushPromises()
    await field(wrapper, 'btn-retest-c-1').trigger('click')
    await flushPromises()

    expect(mockToastError).toHaveBeenCalledWith('SettingsOpenStackView.errors.validationFailed {"error":"invalid_credentials"}')
  })

  // --- delete -------------------------------------------------------

  it('does not delete when the confirmation dialog is dismissed', async () => {
    storeState.credentials = [credential()]
    mockConfirm.mockReturnValue(false)

    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'btn-delete-c-1').trigger('click')

    expect(mockConfirm).toHaveBeenCalledWith('SettingsOpenStackView.confirmDelete {"project":"Project One"}')
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('deletes once the confirmation is accepted', async () => {
    storeState.credentials = [credential()]
    mockConfirm.mockReturnValue(true)

    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'btn-delete-c-1').trigger('click')
    await flushPromises()

    expect(mockRemove).toHaveBeenCalledWith('c-1')
    expect(mockToastSuccess).toHaveBeenCalledWith('SettingsOpenStackView.status.deleteSuccess')
  })

  // --- clouds.yaml upload -------------------------------------------

  it('fills the form from an uploaded clouds.yaml', async () => {
    ;(parseCloudsYaml as any).mockReturnValue({
      auth_type: 'v3applicationcredential',
      auth_url: 'https://yaml.com',
      region_name: 'RegionYaml',
      identifier: 'yaml-id',
      secret: 'yaml-secret',
    })

    const wrapper = mountView()
    await flushPromises()

    const fileInput = field(wrapper, 'yaml-input')
    const file = new File(['dummy yaml content'], 'clouds.yaml', { type: 'text/yaml' })
    Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue('dummy yaml content') })
    Object.defineProperty(fileInput.element, 'files', { value: [file] })

    await fileInput.trigger('change')
    await flushPromises()

    expect(parseCloudsYaml).toHaveBeenCalledWith('dummy yaml content')
    expect(mockToastSuccess).toHaveBeenCalledWith('SettingsOpenStackView.cloudsYamlImported')
    expect((field(wrapper, 'app-auth-url').element as HTMLInputElement).value)
      .toBe('https://yaml.com')
    // Nothing is stored before the user presses "save".
    expect(mockSave).not.toHaveBeenCalled()
  })
})
