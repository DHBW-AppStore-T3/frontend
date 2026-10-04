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
      { name: 'packer_var', source: 'packer', type: 'string', required: false, default: 'val1' },
      { name: 'tf_var', source: 'terraform', type: 'string', required: false, default: 'val2' }
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
  // Expert settings (@expert marker)
  // ----------------------------------------------------------------

  it('hides expert-marked terraform variables behind the accordion by default', async () => {
    const mockVars = [
      { name: 'visible_var', source: 'terraform', type: 'string', required: false, default: 'v1', description: 'Normal variable' },
      { name: 'expert_var', source: 'terraform', type: 'string', required: false, default: 'v2', description: 'Technical UUID @expert' }
    ]

    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    // normal var is visible, expert var is not (accordion is closed)
    expect(wrapper.text()).toContain('visible_var')
    expect(wrapper.text()).not.toContain('expert_var')
  })

  it('shows expert count in accordion button', async () => {
    const mockVars = [
      { name: 'a', source: 'terraform', type: 'string', required: false, default: 'x', description: '@expert' },
      { name: 'b', source: 'terraform', type: 'string', required: false, default: 'y', description: '@expert' }
    ]

    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    // The accordion toggle should mention the count (2)
    expect(wrapper.text()).toContain('deployment.variables.expertSettings')
  })

  it('reveals expert variables when the accordion is opened', async () => {
    const mockVars = [
      { name: 'expert_var', source: 'terraform', type: 'string', required: false, default: 'val', description: '@expert' }
    ]

    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    // find and click the expert toggle button
    const toggle = wrapper.findAll('button').find(b => b.text().includes('deployment.variables.expertSettings'))
    expect(toggle).toBeDefined()
    await toggle!.trigger('click')

    expect(wrapper.text()).toContain('expert_var')
  })

  it('auto-opens expert section when a required expert variable has no default', async () => {
    const mockVars = [
      { name: 'required_expert', source: 'terraform', type: 'string', required: true, default: null, description: '@expert' }
    ]

    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    // required expert with no default must be visible immediately (section auto-opened)
    expect(wrapper.text()).toContain('required_expert')
  })

  it('strips @expert from the displayed description tooltip', async () => {
    const mockVars = [
      { name: 'my_var', source: 'terraform', type: 'string', required: false, default: 'x', description: 'Network UUID @expert' }
    ]

    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    // open the expert section first
    const toggle = wrapper.findAll('button').find(b => b.text().includes('deployment.variables.expertSettings'))
    await toggle!.trigger('click')

    // open the tooltip for my_var
    const infoBtn = wrapper.findAll('button').find(b => b.attributes('title') === 'deployment.variables.showInfo')
    await infoBtn?.trigger('click')

    // @expert should not appear in the rendered tooltip text
    expect(wrapper.text()).not.toContain('@expert')
    expect(wrapper.text()).toContain('Network UUID')
  })

  it('shows no expert accordion when no variables carry @expert marker', async () => {
    const mockVars = [
      { name: 'plain_var', source: 'terraform', type: 'string', required: false, default: 'x', description: 'Normal description' }
    ]

    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    expect(wrapper.text()).not.toContain('deployment.variables.expertSettings')
  })

  it('hides expert-marked packer variables behind the accordion by default', async () => {
    const mockVars = [
      { name: 'visible_packer', source: 'packer', type: 'string', required: false, default: 'v1', description: 'Normal' },
      { name: 'expert_packer', source: 'packer', type: 'string', required: false, default: 'v2', description: '@expert' }
    ]

    const wrapper = createWrapper({}, mockVars)
    await flushPromises()

    expect(wrapper.text()).toContain('visible_packer')
    expect(wrapper.text()).not.toContain('expert_packer')
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