import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import SettingsOpenStackView from '@/views/SettingsOpenStackView.vue'

// ---------------------------------------------------------
// 1. Mocks & Setup
// ---------------------------------------------------------

// i18n im setup() — vue-i18n nicht installiert im Test-Mount.
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, vars?: any) => vars ? `${key} ${JSON.stringify(vars)}` : key
    })
}))

// Router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ push: mockPush })
}))

// Toasts
const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
const mockToastWarning = vi.fn()
vi.mock('@/stores/toast.store', () => ({
    useToastStore: () => ({
        success: mockToastSuccess,
        error: mockToastError,
        warning: mockToastWarning
    })
}))

// YAML Parser
vi.mock('@/utils/clouds-yaml', () => {
    return {
        parseCloudsYaml: vi.fn(),
        CloudsYamlError: class extends Error {}
    }
})
import { parseCloudsYaml } from '@/utils/clouds-yaml'

// Pinia Store für Credentials
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
    lastError: null as string | null,
    error: null as string | null,
    status: {} as any
}

vi.mock('@/stores/openstack-credentials.store', () => ({
    useOpenStackCredentialsStore: () => ({
        get isLocked() { return storeState.isLocked },
        get activeDeployments() { return storeState.activeDeployments },
        get loading() { return storeState.loading },
        get hasCredential() { return storeState.hasCredential },
        get isValidated() { return storeState.isValidated },
        get lastError() { return storeState.lastError },
        get error() { return storeState.error },
        get status() { return storeState.status },
        fetch: mockFetch,
        save: mockSave,
        test: mockTest,
        remove: mockRemove
    })
}))

// Globalen confirm-Dialog simulieren
const originalConfirm = window.confirm
const mockConfirm = vi.fn()

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

// Lucide Icons stubben
vi.mock('lucide-vue-next', () => ({
    CheckCircle2: { template: '<span />' },
    XCircle: { template: '<span />' },
    CircleHelp: { template: '<span />' },
    Cloud: { template: '<span />' },
    KeyRound: { template: '<span />' },
    Trash2: { template: '<span />' },
    RefreshCw: { template: '<span />' },
    Upload: { template: '<span />' },
}))

describe('SettingsOpenStackView.vue', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        window.confirm = mockConfirm

        // Reset Store State
        storeState = {
            isLocked: false,
            activeDeployments: 0,
            loading: false,
            hasCredential: false,
            isValidated: false,
            lastError: null,
            error: null,
            status: {}
        }
    })

    afterEach(() => {
        window.confirm = originalConfirm
    })

    const mountComponent = () => {
        return mount(SettingsOpenStackView, {
            global: {
                stubs: {
                    CredentialMissingBanner: { template: '<div class="stub-banner">Banner</div>' },
                    RouterLink: { template: '<a><slot /></a>' }
                }
            }
        })
    }

    // --- 1. Initiale Ladelogik ---

    it('lädt die Credentials beim Start (Mount)', async () => {
        mountComponent()
        expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('füllt das Formular automatisch aus, wenn bereits App-Credentials existieren', async () => {
        storeState.hasCredential = true
        storeState.status = {
            has_credential: true,
            auth_type: 'v3applicationcredential',
            auth_url: 'https://my-cloud.com:5000/v3',
            region_name: 'RegionOne'
        }

        const wrapper = mountComponent()
        await flushPromises()

        const inputs = wrapper.findAll('input[type="url"]')
        // HIER KORRIGIERT: Type Casting als HTMLInputElement
        expect((inputs[0]!.element as HTMLInputElement).value).toBe('https://my-cloud.com:5000/v3')
    })

    // --- 2. Locked State (Gesperrt wegen aktiver Deployments) ---

    it('sperrt alle Eingabefelder und Buttons, wenn Deployments aktiv sind', async () => {
        storeState.isLocked = true
        storeState.activeDeployments = 2

        const wrapper = mountComponent()
        await flushPromises()

        // Banner muss sichtbar sein
        expect(wrapper.find('.stub-banner').exists()).toBe(true)

        // Formular-Input muss disabled sein
        const input = wrapper.find('input[type="url"]')
        expect(input.attributes('disabled')).toBeDefined()

        // Speichern Button muss disabled sein
        const saveBtn = wrapper.findAll('button').find(b => b.text().includes('SettingsOpenStackView.save'))!
        expect(saveBtn.attributes('disabled')).toBeDefined()
    })

    // --- 3. Speichern (App Credentials) ---

    it('zeigt einen Fehler, wenn beim Speichern Pflichtfelder fehlen', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        // Klick auf Speichern ohne etwas einzugeben
        const saveBtn = wrapper.findAll('button').find(b => b.text().includes('SettingsOpenStackView.save'))!
        await saveBtn.trigger('click')

        expect(mockToastError).toHaveBeenCalledWith('SettingsOpenStackView.errors.missingFields')
        expect(mockSave).not.toHaveBeenCalled()
    })

    it('speichert gültige Application Credentials erfolgreich', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        const urlInput = wrapper.findAll('input').find(i => i.attributes('type') === 'url')!
        await urlInput.setValue('https://test.com')

        // Das erste Text-Input ist Region, das zweite ist Identifier
        const textInputs = wrapper.findAll('input[type="text"]')
        await textInputs[1]!.setValue('my-app-id')

        const pwdInput = wrapper.find('input[type="password"]')
        await pwdInput.setValue('my-secret-key')

        const saveBtn = wrapper.findAll('button').find(b => b.text().includes('SettingsOpenStackView.save'))!
        await saveBtn.trigger('click')
        await flushPromises()

        expect(mockSave).toHaveBeenCalledWith({
            auth_type: 'v3applicationcredential',
            auth_url: 'https://test.com',
            region_name: null,
            interface: 'public',
            identity_api_version: '3',
            identifier: 'my-app-id',
            secret: 'my-secret-key'
        })
        expect(mockToastSuccess).toHaveBeenCalledWith('SettingsOpenStackView.toasts.saveSuccess')
    })

    // --- 4. Tab Wechsel (Password Credentials) ---

    it('wechselt den Tab und speichert Password Credentials korrekt', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        // Tab wechseln
        const pwdTab = wrapper.findAll('button').find(b => b.text().includes('SettingsOpenStackView.tabs.password'))!
        await pwdTab.trigger('click')
        await flushPromises()

        // Password Formular ausfüllen
        const urlInput = wrapper.find('input[type="url"]')
        await urlInput.setValue('https://pwd-cloud.com')

        const textInputs = wrapper.findAll('input[type="text"]')
        await textInputs[1]!.setValue('Default')
        await textInputs[2]!.setValue('admin')
        await textInputs[3]!.setValue('project-123')

        const pwdInput = wrapper.find('input[type="password"]')
        await pwdInput.setValue('super-secret')

        const saveBtn = wrapper.findAll('button').find(b => b.text().includes('SettingsOpenStackView.save'))!
        await saveBtn.trigger('click')
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
            project_domain_name: null
        })
    })

    // --- 5. Löschen ---

    it('bricht das Löschen ab, wenn der User im nativem Dialog auf "Abbrechen" klickt', async () => {
        storeState.hasCredential = true
        mockConfirm.mockReturnValue(false)

        const wrapper = mountComponent()
        await flushPromises()

        const deleteBtn = wrapper.findAll('button').find(b => b.text().includes('SettingsOpenStackView.status.delete'))!
        await deleteBtn.trigger('click')

        expect(mockConfirm).toHaveBeenCalled()
        expect(mockRemove).not.toHaveBeenCalled()
    })

    it('löscht die Credentials erfolgreich, wenn der User auf "Ja" klickt', async () => {
        storeState.hasCredential = true
        mockConfirm.mockReturnValue(true)

        const wrapper = mountComponent()
        await flushPromises()

        const deleteBtn = wrapper.findAll('button').find(b => b.text().includes('SettingsOpenStackView.status.delete'))!
        await deleteBtn.trigger('click')
        await flushPromises()

        expect(mockRemove).toHaveBeenCalledTimes(1)
        expect(mockToastSuccess).toHaveBeenCalledWith('SettingsOpenStackView.status.deleteSuccess')
    })

    // --- 6. Datei Upload (clouds.yaml) ---

    it('liest eine hochgeladene clouds.yaml aus und füllt das Formular', async () => {
        ;(parseCloudsYaml as any).mockReturnValue({
            auth_type: 'v3applicationcredential',
            auth_url: 'https://yaml.com',
            region_name: 'RegionYaml',
            identifier: 'yaml-id',
            secret: 'yaml-secret'
        })

        const wrapper = mountComponent()
        await flushPromises()

        const fileInput = wrapper.find('input[type="file"]')

        const mockFile = new File(['dummy yaml content'], 'clouds.yaml', { type: 'text/yaml' })
        Object.defineProperty(mockFile, 'text', { value: vi.fn().mockResolvedValue('dummy yaml content') })

        Object.defineProperty(fileInput.element, 'files', { value: [mockFile] })
        await fileInput.trigger('change')
        await flushPromises()

        expect(parseCloudsYaml).toHaveBeenCalledWith('dummy yaml content')
        expect(mockToastSuccess).toHaveBeenCalledWith('SettingsOpenStackView.cloudsYamlImported')

        // HIER KORRIGIERT: Type Casting als HTMLInputElement
        const urlInput = wrapper.find('input[type="url"]')
        expect((urlInput.element as HTMLInputElement).value).toBe('https://yaml.com')
    })
})