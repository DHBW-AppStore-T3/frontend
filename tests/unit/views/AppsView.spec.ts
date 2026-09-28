import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

import AppsView from '@/views/AppsView.vue'
import { Code2, Database, Box } from 'lucide-vue-next'

// ---------------------------------------------------------
// 1. Abhängigkeiten (Dependencies) "mocken"
// ---------------------------------------------------------

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockPush })
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
        locale: 'de'
    })
}))

const mockToastError = vi.fn()
vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ error: mockToastError })
}))

vi.mock('@/stores/auth.store', () => ({
    useAuthStore: () => ({ userId: 'other-user-id', isTeacherOrAdmin: false })
}))

vi.mock('@/api/app.api', () => ({
    appApi: {
        list: vi.fn(),
        listVersionApprovals: vi.fn().mockResolvedValue({ data: [] }),
    }
}))
import { appApi } from '@/api/app.api'

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

describe('AppsView.vue', () => {

    beforeEach(() => {
        vi.clearAllMocks()
        // Unterdrücke die Konsolenausgabe für Fehler in unseren Tests
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    const mountComponent = () => {
        return mount(AppsView, {
            global: {
                mocks: {
                    $t: (msg: string) => msg
                },
                stubs: {
                    RouterLink: {
                        props: ['to'],
                        template: '<a :href="to.name" class="router-link-stub"><slot /></a>'
                    },
                    BackCard: { template: '<div><slot /></div>' },
                    BaseButton: { template: '<button><slot /></button>' },
                    AppVersionStatusBadge: { template: '<span></span>' },
                    MarkdownRenderer: {
                        props: ['source'],
                        template: '<div>{{ source }}</div>'
                    }
                }
            }
        })
    }

    // --- Critical Path (Haupt-Funktionen) ---

    it('zeigt den "Empty State" (Keine Apps) an, wenn die API ein leeres Array zurückgibt', async () => {
        ;(appApi.list as any).mockResolvedValue({ data: [] })
        const wrapper = mountComponent()
        await flushPromises()

        // The unified ``EntityListState`` component renders only the
        // description text (no separate heading) when the page is
        // empty — kept consistent across Apps, Deployments, Kurse,
        // Approvals. The ``noAppsTitle`` i18n key is unused since
        // the refactor; keeping the assertion would just test a
        // legacy code path.
        expect(wrapper.text()).toContain('AppsView.noAppsDesc')
    })

    it('zeigt eine Liste von Apps an, wenn die API Daten liefert', async () => {
        const mockApps = [
                { appId: '1', name: 'Meine erste Vue App', description: 'Frontend' },
                { appId: '2', name: 'NodeJS Backend', description: 'API' }
            ]
        ;(appApi.list as any).mockResolvedValue({ data: mockApps })

        const wrapper = mountComponent()
        await flushPromises()

        expect(wrapper.text()).toContain('Meine erste Vue App')
        expect(wrapper.text()).toContain('NodeJS Backend')
    })

    it('zeigt eine Fehlermeldung (Toast) an, wenn der API-Aufruf fehlschlägt', async () => {
        ;(appApi.list as any).mockRejectedValue(new Error('Netzwerkfehler'))
        mountComponent()
        await flushPromises()

        expect(mockToastError).toHaveBeenCalledTimes(1)
        expect(mockToastError).toHaveBeenCalledWith('AppsView.loadError')
    })

    it('navigiert zur Detailseite, wenn auf "Details" geklickt wird', async () => {
        const mockApps = [{ appId: 'app-999', name: 'Test App' }]
        ;(appApi.list as any).mockResolvedValue({ data: mockApps })

        const wrapper = mountComponent()
        await flushPromises()

        const buttons = wrapper.findAll('button')
        const detailButton = buttons.find(b => b.text().includes('workspace.details'))

        await detailButton!.trigger('click')

        expect(mockPush).toHaveBeenCalledWith({
            name: 'apps.detail',
            params: { id: 'app-999' },
            hash: ''
        })
    })

    // --- Erweiterte Tests (Edge Cases & UI Logik) ---

    it('i18n: verwendet die richtigen Übersetzungs-Keys für statische Texte', async () => {
        ;(appApi.list as any).mockResolvedValue({ data: [] })
        const wrapper = mountComponent()
        await flushPromises()

        expect(wrapper.text()).toContain('AppsView.title')
        expect(wrapper.text()).toContain('AppsView.subtitle')
        expect(wrapper.text()).toContain('AppsView.addApp')
    })

    it('Router: der "Hinzufügen" Button verweist auf die richtige Route (apps.create)', async () => {
        ;(appApi.list as any).mockResolvedValue({ data: [] })
        const wrapper = mountComponent()
        await flushPromises()

        const addLink = wrapper.find('a.router-link-stub')
        expect(addLink.attributes('href')).toBe('apps.create')
    })

    it('Icons: rendert das richtige Icon basierend auf dem App-Namen', async () => {
        const mockApps = [
                { appId: '1', name: 'Meine Node App' },     // Sollte 'Server' Icon auslösen
                { appId: '2', name: 'React Dashboard' },    // Sollte 'Globe' Icon auslösen
                { appId: '3', name: 'Python Skript' },      // Sollte 'Box' Icon auslösen
                { appId: '4', name: 'Unbekannte App' }      // Sollte 'Layers' Icon (Default) auslösen
            ]
        ;(appApi.list as any).mockResolvedValue({ data: mockApps })

        const wrapper = mountComponent()
        await flushPromises()

        expect(wrapper.findComponent(Code2).exists()).toBe(true)
        expect(wrapper.findComponent(Database).exists()).toBe(true)
        expect(wrapper.findComponent(Box).exists()).toBe(true)
    })

    it('zeigt einen Lade-Text/Spinner an, während die Daten geladen werden', async () => {
        let resolveApi: any
        ;(appApi.list as any).mockReturnValue(new Promise(resolve => {
            resolveApi = resolve
        }))

        const wrapper = mountComponent()
        await nextTick()

        expect(wrapper.text()).toContain('AppsView.loading')
        resolveApi({ data: [] })
    })

    it('zeigt ein Bild anstelle eines Icons, wenn die App ein eigenes Bild hat', async () => {
        const mockApps = [{
                appId: 'custom-img',
                name: 'App mit Logo',
                image: 'https://mein-server.de/logo.png'
            }]
        ;(appApi.list as any).mockResolvedValue({ data: mockApps })

        const wrapper = mountComponent()
        await flushPromises()

        const img = wrapper.find('img')
        expect(img.exists()).toBe(true)
        expect(img.attributes('src')).toBe('https://mein-server.de/logo.png')
    })
})