import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

import AddAppsView from '@/views/AddAppsView.vue'

// Icons für die Preview-Tests
import { Shield, Server, Box, Layers } from 'lucide-vue-next'

// ---------------------------------------------------------
// 1. Abhängigkeiten (Dependencies) "mocken"
// ---------------------------------------------------------

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockPush })
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, vars?: any) => vars ? `${key}_${JSON.stringify(vars)}` : key,
        locale: 'de'
    })
}))

const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()
vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ error: mockToastError, success: mockToastSuccess })
}))

vi.mock('@/api/app.api', () => ({
    appApi: { create: vi.fn() }
}))
import { appApi } from '@/api/app.api'

// Native Browser-Funktionen für Bilder simulieren
global.URL.createObjectURL = vi.fn(() => 'blob:mocked-url')
global.URL.revokeObjectURL = vi.fn()

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

describe('AddAppsView.vue', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    const mountComponent = () => {
        return mount(AddAppsView, {
            global: {
                mocks: {
                    $t: (msg: string) => msg
                },
                stubs: {
                    // MarkdownEditor exposes a textarea internally, but the
                    // component's heavy lifting (toolbar / preview pane) isn't
                    // what these tests care about — they just need a textarea
                    // bound to ``form.description``. Stub it down to that.
                    MarkdownEditor: {
                        props: ['modelValue', 'placeholder'],
                        emits: ['update:modelValue'],
                        template: `<textarea
                          :value="modelValue"
                          :placeholder="placeholder"
                          @input="$emit('update:modelValue', $event.target.value)"
                        />`
                    },
                    MarkdownRenderer: {
                        props: ['source'],
                        template: '<div>{{ source }}</div>'
                    },
                }
            }
        })
    }

    // --- 1. Formular-Validierungen ---

    it('zeigt einen Fehler, wenn Pflichtfelder (Name, Repo) fehlen', async () => {
        const wrapper = mountComponent()

        const buttons = wrapper.findAll('button')
        const submitButton = buttons[buttons.length - 1]!

        await submitButton.trigger('click')

        expect(mockToastError).toHaveBeenCalledWith('AppsCreateView.messages.missingFields')
        expect(appApi.create).not.toHaveBeenCalled()
    })

    it('zeigt einen Fehler, wenn die Git-URL ein ungültiges Format hat', async () => {
        const wrapper = mountComponent()
        const textInputs = wrapper.findAll('input[type="text"]')

        await textInputs[0]!.setValue('Meine App')
        // Korrektur: Repo-URL ist nun Index 1, da Textarea die Description hält
        await textInputs[1]!.setValue('keine-echte-url')

        const buttons = wrapper.findAll('button')
        await buttons[buttons.length - 1]!.trigger('click')

        expect(mockToastError).toHaveBeenCalledWith('AppsCreateView.messages.invalidUrl')
    })

    // --- 2. Dynamische Vorschau (Computed Properties) ---

    it('ändert das Preview-Icon und die Farbe basierend auf dem App-Namen', async () => {
        const wrapper = mountComponent()
        const nameInput = wrapper.findAll('input[type="text"]')[0]!

        await nameInput.setValue('Kali Linux')
        expect(wrapper.findComponent(Shield).exists()).toBe(true)
        expect(wrapper.findComponent(Shield).classes()).toContain('text-info')

        await nameInput.setValue('Node Backend')
        expect(wrapper.findComponent(Server).exists()).toBe(true)

        await nameInput.setValue('Python Script')
        expect(wrapper.findComponent(Box).exists()).toBe(true)

        await nameInput.setValue('Unbekanntes Framework')
        expect(wrapper.findComponent(Layers).exists()).toBe(true)
    })

    // --- 3. Datei-Upload (Bilder) ---

    it('lehnt Dateien ab, die keine Bilder sind', async () => {
        const wrapper = mountComponent()
        const fileInput = wrapper.find('input[type="file"]')

        const file = new File(['text content'], 'test.txt', { type: 'text/plain' })

        Object.defineProperty(fileInput.element, 'files', {
            value: [file]
        })
        await fileInput.trigger('change')

        expect(mockToastError).toHaveBeenCalledWith('AppsCreateView.messages.onlyImages')
    })

    it('lehnt Bilder ab, die größer als 2MB sind', async () => {
        const wrapper = mountComponent()
        const fileInput = wrapper.find('input[type="file"]')

        const hugeFile = new File([''], 'huge.png', { type: 'image/png' })
        Object.defineProperty(hugeFile, 'size', { value: 3 * 1024 * 1024 })

        Object.defineProperty(fileInput.element, 'files', { value: [hugeFile] })
        await fileInput.trigger('change')

        expect(mockToastError).toHaveBeenCalledWith('AppsCreateView.messages.imageTooLarge_{"size":2}')
    })

    it('akzeptiert gültige Bilder und zeigt eine Vorschau an', async () => {
        const wrapper = mountComponent()
        const fileInput = wrapper.find('input[type="file"]')

        const validFile = new File(['dummy content'], 'logo.png', { type: 'image/png' })
        Object.defineProperty(validFile, 'size', { value: 1024 })

        Object.defineProperty(fileInput.element, 'files', { value: [validFile] })
        await fileInput.trigger('change')

        const img = wrapper.find('img')
        expect(img.exists()).toBe(true)
        expect(img.attributes('src')).toBe('blob:mocked-url')
    })

    // --- 4. Erfolgreiches Speichern ---

    it('sendet die Daten erfolgreich an die API und navigiert zur Liste', async () => {
        const wrapper = mountComponent()
        const textInputs = wrapper.findAll('input[type="text"]')
        const textArea = wrapper.find('textarea')

        await textInputs[0]!.setValue('Super App')
        // Korrektur: Die Beschreibung in das korrekte textarea Feld schreiben
        await textArea.setValue('Eine Testbeschreibung')
        // Korrektur: Repo-URL ist Index 1
        await textInputs[1]!.setValue('https://github.com/user/repo')

        const buttons = wrapper.findAll('button')
        await buttons[buttons.length - 1]!.trigger('click')

        await flushPromises()

        expect(appApi.create).toHaveBeenCalledTimes(1)
        expect(appApi.create).toHaveBeenCalledWith({
            name: 'Super App',
            description: 'Eine Testbeschreibung',
            git_link: 'https://github.com/user/repo',
            image: null,
            is_private: false,
            submit_all_versions: false,
        })

        expect(mockToastSuccess).toHaveBeenCalledWith('AppsCreateView.messages.success')
        expect(mockPush).toHaveBeenCalledWith({ name: 'apps' })
    })

    // --- 5. Fehler beim Speichern ---

    it('zeigt eine korrekte Fehlermeldung, wenn die API 403 (No Access) zurückgibt', async () => {
        ;(appApi.create as any).mockRejectedValue({
            response: { status: 403 }
        })

        const wrapper = mountComponent()
        const textInputs = wrapper.findAll('input[type="text"]')

        await textInputs[0]!.setValue('Super App')
        // Korrektur: Repo-URL ist Index 1
        await textInputs[1]!.setValue('https://github.com/user/repo')

        const buttons = wrapper.findAll('button')
        await buttons[buttons.length - 1]!.trigger('click')
        await flushPromises()

        expect(mockToastError).toHaveBeenCalledWith('AppsCreateView.messages.noAccess')
    })
})