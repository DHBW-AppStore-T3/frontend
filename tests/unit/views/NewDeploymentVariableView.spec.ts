import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useRouter } from 'vue-router'

// Anpassen an deinen tatsächlichen Dateinamen / Pfad
import DeploymentVariables from '@/views/NewDeploymentVariableView.vue'
// NEU: Die Komponente direkt importieren, um sie sicher im Test zu finden
import VariableInput from '@/components/VariableInput.vue' 

import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { useToast } from '@/composables/useToast'

// --- MOCKS ---
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn()
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
    success: vi.fn(),
    info: vi.fn()
  }))
}))

// Mock für den dynamischen Import des OpenStack Caches
vi.mock('@/composables/useOpenStackResourceCache', () => ({
  ensureLoaded: vi.fn().mockResolvedValue(undefined)
}))

describe('NewDeploymentVariableView.vue', () => {
  let routerPushMock: any
  let routerReplaceMock: any
  let toastErrorMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    routerPushMock = vi.fn()
    routerReplaceMock = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ 
      push: routerPushMock,
      replace: routerReplaceMock
    } as any)
    
    toastErrorMock = vi.fn()
    vi.mocked(useToast).mockReturnValue({
      error: toastErrorMock,
      info: vi.fn(),
      warning: vi.fn(),
      success: vi.fn(),
      clear: vi.fn()
    } as any)
  })

  function createWrapper(draftOverrides: any = {}, mockVariables: any[] = []) {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        deployment: {
          studentCache: new Map(),
          draft: {
            appId: 'app-1',
            name: 'Test Deployment',
            releaseTag: '1.0.0',
            variables: {},
            userInputVar: '',
            variableDefinitions: [],
            fileUploads: {},
            groupNames: ['Team 1'],
            assignments: { 0: ['u1'] },
            ...draftOverrides
          }
        }
      }
    })

    const appStore = useAppStore(pinia)
    appStore.fetchAppVariables = vi.fn().mockResolvedValue(mockVariables)

    return mount(DeploymentVariables, {
      global: {
        plugins: [pinia],
        stubs: {
          DeploymentProgressBar: true,
          VariableInput: true, // FIX: Nutzt jetzt den automatischen Stub von Vue Test Utils
          FileDropZone: true,
          ScopeBadge: true,
          Box: true,
          Layers: true,
          Info: true,
          AlertTriangle: true,
          ArrowRight: true,
          ArrowLeft: true
        }
      }
    })
  }

  it('redirects to /apps if no appId is present in draft', async () => {
    createWrapper({ appId: null })
    await flushPromises()

    expect(routerReplaceMock).toHaveBeenCalledWith('/apps')
  })

  it('fetches variables and groups them into packer and terraform sections', async () => {
    const mockVars = [
      { name: 'packer_var', source: 'packer', type: 'string', required: true, default: null },
      { name: 'tf_var', source: 'terraform', type: 'string', required: true, default: null }
    ]
    
    const wrapper = createWrapper({}, mockVars)
    await flushPromises() // Warten auf Loading und API-Call

    const appStore = useAppStore()
    expect(appStore.fetchAppVariables).toHaveBeenCalledWith('app-1', '1.0.0')

    // Beiden Sektionen sollten gerendert werden (Namen der Variablen sind sichtbar)
    expect(wrapper.text()).toContain('packer_var')
    expect(wrapper.text()).toContain('tf_var')
  })

  it('blocks navigation if a required variable is missing (Required-Gating)', async () => {
    const mockVars = [
      // Required Variable ohne Default-Wert
      { name: 'db_password', source: 'terraform', type: 'string', required: true }
    ]
    
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    // Next-Button sollte im disabled-State sein (Klasse oder Attribut)
    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('deployment.actions.next'))
    expect(nextBtn?.attributes('disabled')).toBeDefined()
    expect(nextBtn?.classes()).toContain('cursor-not-allowed')
    
    // Warnhinweis für fehlende Felder sollte sichtbar sein
    expect(wrapper.text()).toContain('deployment.variables.missingRequiredTitle')
    expect(wrapper.text()).toContain('db_password')
  })

  it('allows navigation and saves variables when required fields are filled', async () => {
    const mockVars = [
      { name: 'db_password', source: 'terraform', type: 'string', required: true }
    ]
    
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    const deploymentStore = useDeploymentStore()

    // FIX: VariableInput sicher über den direkten Import finden
    const varInput = wrapper.findComponent(VariableInput)
    await varInput.vm.$emit('update:modelValue', 'secret123')
    
    // Warten, bis Vue die formValues aktualisiert hat und computed properties (canSubmit) neu berechnet
    await wrapper.vm.$nextTick()

    // Next-Button klicken
    const nextBtn = wrapper.findAll('button').find(b => b.text().includes('deployment.actions.next'))
    expect(nextBtn?.attributes('disabled')).toBeUndefined()
    await nextBtn?.trigger('click')

    // Prüfen, ob Store korrekt befüllt wurde (userInputVar als JSON String)
    const expectedChanges = { db_password: 'secret123' }
    expect(deploymentStore.draft.userInputVar).toBe(JSON.stringify(expectedChanges))
    
    // Prüfen, ob weitergeleitet wurde
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployment.summary' })
  })

  it('navigates back to the teams step when the back button is clicked', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const backBtn = wrapper.findAll('button').find(b => b.text().includes('deployment.actions.back'))
    await backBtn?.trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployment.teams' })
  })

  // ----------------------------------------------------------------
  // Experteneinstellungen: automatische Sichtbarkeitsregel
  // Sichtbar:  required === true && default === null/undefined
  // Versteckt: optional ODER hat Default-Wert
  // ----------------------------------------------------------------

  it('shows required terraform variable with null default directly', async () => {
    const mockVars = [
      { name: 'must_fill', source: 'terraform', type: 'string', required: true, default: null }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).toContain('must_fill')
    expect(wrapper.text()).not.toContain('deployment.variables.expertSettings')
  })

  it('shows required terraform variable with undefined default directly', async () => {
    const mockVars = [
      { name: 'must_fill_undef', source: 'terraform', type: 'string', required: true }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).toContain('must_fill_undef')
    expect(wrapper.text()).not.toContain('deployment.variables.expertSettings')
  })

  it('hides optional terraform variable (required: false) behind the accordion', async () => {
    const mockVars = [
      { name: 'optional_var', source: 'terraform', type: 'string', required: false, default: 'some-default' }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).not.toContain('optional_var')
    expect(wrapper.text()).toContain('deployment.variables.expertSettings')
  })

  it('hides required terraform variable that has a non-null default behind the accordion', async () => {
    const mockVars = [
      { name: 'has_default', source: 'terraform', type: 'string', required: true, default: 'preset-uuid' }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).not.toContain('has_default')
    expect(wrapper.text()).toContain('deployment.variables.expertSettings')
  })

  it('shows only accordion toggle when all terraform vars have defaults', async () => {
    const mockVars = [
      { name: 'var_a', source: 'terraform', type: 'string', required: true, default: 'val-a' },
      { name: 'var_b', source: 'terraform', type: 'string', required: false, default: 'val-b' }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).not.toContain('var_a')
    expect(wrapper.text()).not.toContain('var_b')
    expect(wrapper.text()).toContain('deployment.variables.expertSettings')
  })

  it('shows accordion count for auto-hidden terraform variables', async () => {
    const mockVars = [
      { name: 'a', source: 'terraform', type: 'string', required: false, default: 'x' },
      { name: 'b', source: 'terraform', type: 'string', required: false, default: 'y' }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).toContain('deployment.variables.expertSettings')
  })

  it('reveals auto-hidden terraform variables when accordion is opened', async () => {
    const mockVars = [
      { name: 'hidden_var', source: 'terraform', type: 'string', required: false, default: 'val' }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).not.toContain('hidden_var')

    const toggle = wrapper.findAll('button').find(b => b.text().includes('deployment.variables.expertSettings'))
    expect(toggle).toBeDefined()
    await toggle!.trigger('click')
    expect(wrapper.text()).toContain('hidden_var')
  })

  it('shows no accordion when all terraform variables are required with no default', async () => {
    const mockVars = [
      { name: 'req_a', source: 'terraform', type: 'string', required: true, default: null },
      { name: 'req_b', source: 'terraform', type: 'string', required: true }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).toContain('req_a')
    expect(wrapper.text()).toContain('req_b')
    expect(wrapper.text()).not.toContain('deployment.variables.expertSettings')
  })

  it('hides packer variable with a default behind the packer accordion', async () => {
    const mockVars = [
      { name: 'visible_packer', source: 'packer', type: 'string', required: true, default: null },
      { name: 'hidden_packer', source: 'packer', type: 'string', required: false, default: 'uuid-default' }
    ]
    const wrapper = createWrapper({}, mockVars)
    await flushPromises()
    expect(wrapper.text()).toContain('visible_packer')
    expect(wrapper.text()).not.toContain('hidden_packer')
  })

  it('shows error toast when fetchAppVariables fails', async () => {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        deployment: {
          draft: { appId: 'app-1', variableDefinitions: [] }
        }
      }
    })
    
    const appStore = useAppStore(pinia)
    appStore.fetchAppVariables = vi.fn().mockRejectedValue(new Error('Network Error'))

    mount(DeploymentVariables, {
      global: {
        plugins: [pinia],
        stubs: { DeploymentProgressBar: true, Box: true, Layers: true, ArrowLeft: true, ArrowRight: true }
      }
    })

    await flushPromises()
    
    expect(toastErrorMock).toHaveBeenCalledWith('deployment.summary.fetchVarsError')
  })
})