import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

import AppsDetailView from '@/views/AppsDetailView.vue'

// ---------------------------------------------------------
// 1. Mocks & Setup
// ---------------------------------------------------------

// Router & Route
const mockPush = vi.fn()
const mockBack = vi.fn()
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockPush, back: mockBack }),
    useRoute: () => ({ params: { id: 'app-123' } })
}))

// i18n
vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key })
}))

// Toast
const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()
const mockToastWarning = vi.fn()
vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ error: mockToastError, success: mockToastSuccess, warning: mockToastWarning })
}))

// API
vi.mock('@/api/app.api', () => ({
    appApi: {
        getById: vi.fn(),
        delete: vi.fn()
    }
}))
import { appApi } from '@/api/app.api'

// Stores (Pinia) simulieren
const mockDeploymentReset = vi.fn()
const mockDeploymentDraft = { appId: '', releaseTag: '' }

vi.mock('@/stores/deployment.store', () => ({
    useDeploymentStore: () => ({
        resetDraft: mockDeploymentReset,
        draft: mockDeploymentDraft
    })
}))

vi.mock('@/stores/openstack-credentials.store', () => ({
    useOpenStackCredentialsStore: () => ({
        isResolved: true,
        hasCredential: true
    })
}))

vi.mock('@/stores/auth.store', () => ({
    useAuthStore: () => ({
        isTeacherOrAdmin: false,
        userId: 'user-1'
    })
}))

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

describe('AppsDetailView.vue', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        // Standard-Antwort der API
        ;(appApi.getById as any).mockResolvedValue({
            data: {
                id: 'app-123',
                name: 'Test App',
                description: 'Detail Beschreibung',
                userId: 'user-1',
                versions: ['v1.0', 'v2.0']
            }
        })
    })

    const mountComponent = () => {
        return mount(AppsDetailView, {
            global: {
                mocks: { $t: (msg: string) => msg },
                stubs: {
                    BaseButton: { template: '<button><slot /></button>' },
                    Modal: {
                        props: ['show'],
                        template: '<div v-if="$props.show" class="modal"><slot name="title" /><slot /><slot name="footer" /></div>'
                    },
                    RouterLink: true,
                    MarkdownRenderer: {
                        props: ['source'],
                        template: '<div>{{ source }}</div>'
                    }
                }
            }
        })
    }

    // --- 1. Laden und Anzeigen ---

    it('lädt die App-Details anhand der ID aus der URL', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        expect(appApi.getById).toHaveBeenCalledWith('app-123', false)
        expect(wrapper.text()).toContain('Test App')
        expect(wrapper.text()).toContain('Detail Beschreibung')
    })

    it('leitet zur Liste um und zeigt einen Fehler, wenn die App nicht gefunden wird', async () => {
        ;(appApi.getById as any).mockRejectedValue(new Error('Not found'))

        mountComponent()
        await flushPromises()

        expect(mockToastError).toHaveBeenCalledWith('AppsDetailView.toasts.loadError')
        expect(mockPush).toHaveBeenCalledWith({ name: 'apps' })
    })

    it('wählt automatisch die erste Version aus, wenn Versionen vorhanden sind', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        const select = wrapper.find('select')
        expect(select.element.value).toBe('v1.0')
    })

    // --- 2. Deployment (Bereitstellung) ---

    it('speichert die Auswahl im Deployment-Store und navigiert zur Config', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        const deployButton = wrapper.findAll('button').find(b => b.text().includes('AppsDetailView.deployButton'))!
        await deployButton.trigger('click')

        expect(mockDeploymentReset).toHaveBeenCalled()
        expect(mockDeploymentDraft.appId).toBe('app-123')
        expect(mockDeploymentDraft.releaseTag).toBe('v1.0')
        expect(mockPush).toHaveBeenCalledWith({ name: 'deployment.config' })
    })

    it('deaktiviert den Deploy-Button und warnt (Fallback), wenn keine Version ausgewählt ist', async () => {
        // API liefert App OHNE Versionen
        ;(appApi.getById as any).mockResolvedValue({
            data: { id: 'app-123', name: 'Leere App', versions: [] }
        })

        const wrapper = mountComponent()
        await flushPromises()

        const deployButton = wrapper.findAll('button').find(b => b.text().includes('AppsDetailView.deployButton'))!

        // 1. UI-Prüfung: Der Button muss für den Nutzer gesperrt (disabled) sein
        expect(deployButton.attributes('disabled')).toBeDefined()

        // 2. Logik-Prüfung: Wir rufen die interne Funktion direkt auf, um das Sicherheitsnetz zu testen
        ;(wrapper.vm as any).handleDeploy()

        expect(mockToastWarning).toHaveBeenCalledWith('AppsDetailView.toasts.selectVersionFirst')
        expect(mockPush).not.toHaveBeenCalled()
    })

    // --- 3. Löschen (Modal & API) ---

    it('zeigt den Lösch-Button an, wenn der Nutzer der Besitzer ist, und öffnet das Modal', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        const deleteButton = wrapper.findAll('button').find(b => b.text().includes('AppsDetailView.deleteApp'))!
        expect(deleteButton.exists()).toBe(true)

        await deleteButton.trigger('click')
        await nextTick()

        const modal = wrapper.find('.modal')
        expect(modal.exists()).toBe(true)
        expect(modal.text()).toContain('AppsDetailView.confirmDeleteTitle')
    })

    it('löscht die App erfolgreich nach Bestätigung im Modal', async () => {
        ;(appApi.delete as any).mockResolvedValue({})

        const wrapper = mountComponent()
        await flushPromises()

        const deleteButton = wrapper.findAll('button').find(b => b.text().includes('AppsDetailView.deleteApp'))!
        await deleteButton.trigger('click')
        await nextTick()

        const confirmBtn = wrapper.findAll('.modal button').find(b => b.text().includes('AppsDetailView.confirmButton'))!
        await confirmBtn.trigger('click')
        await flushPromises()

        expect(appApi.delete).toHaveBeenCalledWith('app-123')
        expect(mockToastSuccess).toHaveBeenCalledWith('AppsDetailView.deleteSuccessToast')
        expect(mockPush).toHaveBeenCalledWith({ name: 'apps' })
    })

    // --- 4. Navigation ---

    it('navigiert zurück, wenn der Zurück-Button geklickt wird', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        const backButton = wrapper.findAll('button').find(b => b.text().includes('AppsDetailView.backToOverview'))!
        await backButton.trigger('click')

        expect(mockBack).toHaveBeenCalledTimes(1)
    })
})