import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import SettingsOpenStackView from '@/views/SettingsOpenStackView.vue'

// ---------------------------------------------------------------
// Rewritten from a `describe.skip` dated 2026-06-29. The TODO blamed
// "i18n rework + UI refactor of PR #77 broke the tests' DOM selectors",
// which is precisely what it was: fields were looked up by position
// (`textInputs[1]`, `textInputs[2]`) and buttons by German label text
// (`b.text().includes('Speichern')`). Reordering a form field or
// translating a button broke tests about credential handling.
//
// The view now carries `data-testid` on its inputs, tabs and action
// buttons. Those are a deliberate testing contract: they do not move
// when the layout or the translations do. Assertions are on the
// payload handed to the store and the i18n *key* passed to the toast,
// never on rendered German.
// ---------------------------------------------------------------

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, vars?: any) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
  }),
}))

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
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

const mockFetch = vi.fn()
const mockSave = vi.fn()
const mockTest = vi.fn()
const mockRemove = vi.fn()

let storeState = {
  isLocked: false,
  activeDeployments: 0,
  loading: false,
  hasCredential: false,
  isValidated: false,
  isResolved: true,
  lastError: null as string | null,
  error: null as string | null,
  status: {} as any,
}

vi.mock('@/stores/openstack-credentials.store', () => ({
  useOpenStackCredentialsStore: () => ({
    get isLocked() { return storeState.isLocked },
    get activeDeployments() { return storeState.activeDeployments },
    get loading() { return storeState.loading },
    get hasCredential() { return storeState.hasCredential },
    get isValidated() { return storeState.isValidated },
    get isResolved() { return storeState.isResolved },
    get lastError() { return storeState.lastError },
    get error() { return storeState.error },
    get status() { return storeState.status },
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
        CredentialMissingBanner: true,
        RouterLink: { template: '<a><slot /></a>' },
      },
    },
  })

const field = (wrapper: any, id: string) => wrapper.get(`[data-testid="${id}"]`)

describe('SettingsOpenStackView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.confirm = mockConfirm
    storeState = {
      isLocked: false,
      activeDeployments: 0,
      loading: false,
      hasCredential: false,
      isValidated: false,
      isResolved: true,
      lastError: null,
      error: null,
      status: {},
    }
  })

  afterEach(() => {
    window.confirm = originalConfirm
  })

  it('loads the stored credential on mount', () => {
    mountView()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('prefills the form from an existing application credential', async () => {
    storeState.hasCredential = true
    storeState.status = {
      has_credential: true,
      auth_type: 'v3applicationcredential',
      auth_url: 'https://my-cloud.com:5000/v3',
      region_name: 'RegionOne',
    }

    const wrapper = mountView()
    await flushPromises()

    expect((field(wrapper, 'app-auth-url').element as HTMLInputElement).value)
      .toBe('https://my-cloud.com:5000/v3')
    expect((field(wrapper, 'app-region').element as HTMLInputElement).value)
      .toBe('RegionOne')
  })

  // --- locked state -------------------------------------------------

  it('disables the form and the destructive actions while deployments are active', async () => {
    storeState.isLocked = true
    storeState.activeDeployments = 2
    // The retest/delete pair lives in the status card, which only renders
    // once a credential exists.
    storeState.hasCredential = true

    const wrapper = mountView()
    await flushPromises()

    expect(field(wrapper, 'app-auth-url').attributes('disabled')).toBeDefined()
    expect(field(wrapper, 'btn-save').attributes('disabled')).toBeDefined()
    expect(field(wrapper, 'btn-delete').attributes('disabled')).toBeDefined()
  })

  // --- saving -------------------------------------------------------

  it('refuses to save with required fields missing and says why', async () => {
    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'btn-save').trigger('click')

    expect(mockSave).not.toHaveBeenCalled()
    expect(mockToastError).toHaveBeenCalledWith('SettingsOpenStackView.errors.missingFields')
  })

  it('saves an application credential with the fields the API expects', async () => {
    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'app-auth-url').setValue('https://test.com')
    await field(wrapper, 'app-identifier').setValue('my-app-id')
    await field(wrapper, 'app-secret').setValue('my-secret-key')
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
    expect(mockToastSuccess).toHaveBeenCalledWith('SettingsOpenStackView.toasts.saveSuccess')
  })

  it('clears the secret from the form after a successful save', async () => {
    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'app-auth-url').setValue('https://test.com')
    await field(wrapper, 'app-identifier').setValue('my-app-id')
    await field(wrapper, 'app-secret').setValue('my-secret-key')
    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect((field(wrapper, 'app-secret').element as HTMLInputElement).value).toBe('')
  })

  it('warns instead of celebrating when the credential saves but fails validation', async () => {
    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'app-auth-url').setValue('https://test.com')
    await field(wrapper, 'app-identifier').setValue('my-app-id')
    await field(wrapper, 'app-secret').setValue('my-secret-key')
    mockSave.mockImplementation(async () => { storeState.lastError = 'invalid credentials' })

    await field(wrapper, 'btn-save').trigger('click')
    await flushPromises()

    expect(mockToastWarning).toHaveBeenCalled()
    expect(mockToastSuccess).not.toHaveBeenCalled()
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

  // --- delete -------------------------------------------------------

  it('does not delete when the confirmation dialog is dismissed', async () => {
    storeState.hasCredential = true
    mockConfirm.mockReturnValue(false)

    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'btn-delete').trigger('click')

    expect(mockConfirm).toHaveBeenCalled()
    expect(mockRemove).not.toHaveBeenCalled()
  })

  it('deletes once the confirmation is accepted', async () => {
    storeState.hasCredential = true
    mockConfirm.mockReturnValue(true)

    const wrapper = mountView()
    await flushPromises()

    await field(wrapper, 'btn-delete').trigger('click')
    await flushPromises()

    expect(mockRemove).toHaveBeenCalledTimes(1)
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
  })
})
