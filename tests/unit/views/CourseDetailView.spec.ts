import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

import CourseDetailView from '@/views/CourseDetailView.vue'

// ---------------------------------------------------------
// 1. Mocks & Setup
// ---------------------------------------------------------

const mockPush = vi.fn()
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockPush }),
    useRoute: () => ({ params: { id: 'c-123' } })
}))

// i18n Mock (unterstützt Variablen)
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, vars?: any) => vars ? `${key} ${JSON.stringify(vars)}` : key
    })
}))

const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()
vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ error: mockToastError, success: mockToastSuccess })
}))

// Rechteverwaltung
const mockCan = { editCourse: { value: true } }
vi.mock('@/composables/usePermissions', () => ({
    usePermissions: () => ({ can: mockCan })
}))

// useRole greift intern auf useAuthStore (Pinia) zu — daher hier mocken.
// ``isStaff`` muss ein echter Vue ``ref`` sein, damit das Template-
// Auto-Unwrap funktioniert (sonst ist ``{ value: false }`` immer truthy).
const mockIsStaff = ref(true)
vi.mock('@/composables/useRole', () => ({
    useRole: () => ({ isStaff: mockIsStaff })
}))

// User API
vi.mock('@/api/user.api', () => ({
    userApi: {
        list: vi.fn(),
        search: vi.fn()
    }
}))
import { userApi } from '@/api/user.api'

// Course Store simulieren
const mockFetchCourseById = vi.fn()
const mockFetchCourses = vi.fn()
const mockUpdateCourse = vi.fn()
const mockAddMembers = vi.fn()
const mockRemoveMember = vi.fn()

let mockCurrentCourse: any = null
let mockCurrentMembers: any[] = []
let mockIsLoading = false

vi.mock('@/stores/course.store', () => ({
    useCourseStore: () => ({
        get currentCourse() { return mockCurrentCourse },
        get currentMembers() { return mockCurrentMembers },
        get courses() { return mockCurrentCourse ? [mockCurrentCourse] : [] },
        get isLoading() { return mockIsLoading },
        fetchCourseById: mockFetchCourseById,
        fetchCourses: mockFetchCourses,
        updateCourse: mockUpdateCourse,
        addMembers: mockAddMembers,
        removeMember: mockRemoveMember
    })
}))

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

describe('CourseDetailView.vue', () => {

    beforeEach(() => {
        vi.clearAllMocks()

        // Standard-Zustand für erfolgreichen Start
        mockCurrentCourse = { courseId: 'c-123', name: 'Vue 3 Masterclass' }
        mockCurrentMembers = []
        mockIsLoading = false
        mockCan.editCourse.value = true
        mockIsStaff.value = true

        mockFetchCourseById.mockResolvedValue(undefined)
        ;(userApi.list as any).mockResolvedValue({ data: [] })
    })

    afterEach(() => {
        // Falls wir Fake Timers genutzt haben, setzen wir sie nach dem Test zurück
        vi.useRealTimers()
    })

    const mountComponent = () => {
        return mount(CourseDetailView, {
            global: {
                mocks: {
                    $t: (key: string, vars?: any) => vars ? `${key} ${JSON.stringify(vars)}` : key
                },
                stubs: {
                    Card: { template: '<div class="stub-card"><slot /></div>' },
                    BaseButton: { template: '<button><slot /></button>' },
                    BaseInput: {
                        props: ['modelValue'],
                        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" @keyup.enter="$emit(\'keyup\', {key: \'Enter\'})" />'
                    },
                    Modal: {
                        props: ['show'],
                        template: '<div v-if="$props.show" class="modal"><slot name="header" /><slot name="body" /><slot name="footer" /></div>'
                    }
                }
            }
        })
    }

    // --- 1. Ladezustände & Basis-Anzeige ---

    it('lädt den Kurs beim Start und zeigt den Namen an', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        expect(mockFetchCourseById).toHaveBeenCalledWith('c-123')
        expect(wrapper.text()).toContain('Vue 3 Masterclass')
    })

    it('zeigt einen Fehler und navigiert zurück, wenn der Kurs nicht existiert', async () => {
        mockFetchCourseById.mockRejectedValue(new Error('Not found'))
        mockCurrentCourse = null

        mountComponent()
        await flushPromises()

        expect(mockToastError).toHaveBeenCalledWith('CourseDetailView.toasts.loadError')
        expect(mockPush).toHaveBeenCalledWith({ path: '/courses' })
    })

    // --- 2. Inline-Editing (Kursnamen bearbeiten) ---

    it('startet das Bearbeiten des Namens und speichert die Änderung', async () => {
        mockUpdateCourse.mockResolvedValue(undefined)
        const wrapper = mountComponent()
        await flushPromises()

        // 1. Bearbeiten-Icon klicken
        const editBtn = wrapper.find('button[title="CourseDetailView.editNameTitle"]')
        await editBtn.trigger('click')

        // 2. Im Input-Feld den Namen ändern
        const input = wrapper.find('input')
        await input.setValue('Vue 3 Masterclass - Update')

        // 3. Speichern klicken
        const saveBtn = wrapper.find('button[title="CourseDetailView.save"]')
        await saveBtn.trigger('click')
        await flushPromises()

        expect(mockUpdateCourse).toHaveBeenCalledWith('c-123', { name: 'Vue 3 Masterclass - Update' })
        expect(mockToastSuccess).toHaveBeenCalledWith('CourseDetailView.toasts.nameUpdated')
    })

    it('bricht das Bearbeiten des Namens ab', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        await wrapper.find('button[title="CourseDetailView.editNameTitle"]').trigger('click')

        // Abbrechen klicken
        const cancelBtn = wrapper.find('button[title="CourseDetailView.cancel"]')
        await cancelBtn.trigger('click')

        // Das Input-Feld sollte wieder verschwunden sein
        expect(wrapper.find('input').exists()).toBe(false)
        expect(mockUpdateCourse).not.toHaveBeenCalled()
    })

    // --- 3. Rechteverwaltung ---

    it('versteckt Bearbeiten- und Hinzufügen-Buttons, wenn Rechte fehlen', async () => {
        mockCan.editCourse.value = false
        mockIsStaff.value = false
        const wrapper = mountComponent()
        await flushPromises()

        expect(wrapper.find('button[title="CourseDetailView.editNameTitle"]').exists()).toBe(false)
        expect(wrapper.text()).not.toContain('CourseDetailView.addMemberBtn')
    })

    // --- 4. Mitglieder Hinzufügen (Modal & Suche) ---

    it('öffnet das Hinzufügen-Modal und lädt initiale Benutzer', async () => {
        const mockUsers = [{ userId: 'u-1', username: 'TestUser' }]
        ;(userApi.list as any).mockResolvedValue({ data: mockUsers })

        const wrapper = mountComponent()
        await flushPromises()

        // Hinzufügen klicken
        const addBtn = wrapper.findAll('button').find(b => b.text().includes('CourseDetailView.addMemberBtn'))!
        await addBtn.trigger('click')
        await flushPromises()

        // Prüfen, ob API aufgerufen wurde und Nutzer im Modal steht
        expect(userApi.list).toHaveBeenCalledWith({ role: 'student', limit: 100 })

        const modal = wrapper.find('.modal')
        expect(modal.exists()).toBe(true)
        expect(modal.text()).toContain('TestUser')
    })

    it('sucht nach Benutzern mit 300ms Verzögerung (Debounce)', async () => {
        // Fake Timers aktivieren, um die 300ms zu simulieren
        vi.useFakeTimers()
        ;(userApi.search as any).mockResolvedValue({ data: [{ userId: 'u-2', username: 'SearchedUser' }] })

        const wrapper = mountComponent()
        await flushPromises()

        // Modal öffnen
        await wrapper.findAll('button').find(b => b.text().includes('CourseDetailView.addMemberBtn'))!.trigger('click')
        await flushPromises()

        // In das Suchfeld tippen
        const searchInput = wrapper.findAll('input').find(i => i.attributes('placeholder') === 'CourseDetailView.addModal.searchPlaceholder')!
        await searchInput.setValue('Sear')

        // Die API darf noch NICHT aufgerufen worden sein (wegen Debounce)
        expect(userApi.search).not.toHaveBeenCalled()

        // Wir spulen die Zeit virtuell um 350ms vor
        vi.advanceTimersByTime(350)
        await flushPromises()

        // Jetzt muss die API gerufen worden sein
        expect(userApi.search).toHaveBeenCalledWith('Sear', 10)
        expect(wrapper.find('.modal').text()).toContain('SearchedUser')
    })

    it('wählt Nutzer aus und fügt sie zum Kurs hinzu', async () => {
        const mockUsers = [{ userId: 'u-1', username: 'TestUser' }]
        ;(userApi.list as any).mockResolvedValue({ data: mockUsers })
        mockAddMembers.mockResolvedValue(undefined)

        const wrapper = mountComponent()
        await flushPromises()

        // Modal öffnen
        await wrapper.findAll('button').find(b => b.text().includes('CourseDetailView.addMemberBtn'))!.trigger('click')
        await flushPromises()

        // Checkbox anklicken
        const checkbox = wrapper.find('input[type="checkbox"]')
        await checkbox.trigger('change')

        // Speichern klicken
        const submitBtn = wrapper.findAll('.modal button').find(b => b.text().includes('CourseDetailView.addModal.addCount'))!
        await submitBtn.trigger('click')
        await flushPromises()

        expect(mockAddMembers).toHaveBeenCalledWith('c-123', ['u-1'])
        expect(mockToastSuccess).toHaveBeenCalledWith('CourseDetailView.toasts.membersAddedSingular')
    })

    // --- 5. Mitglieder Löschen (Modal) ---

    it('öffnet das Löschen-Modal und entfernt einen Benutzer', async () => {
        mockCurrentMembers = [{ userId: 'u-99', username: 'BadUser', role: 'student' }]
        mockRemoveMember.mockResolvedValue(undefined)

        const wrapper = mountComponent()
        await flushPromises()

        // Mülleimer-Icon des Nutzers klicken
        const removeIconBtn = wrapper.find('button[title="CourseDetailView.removeMemberTitle"]')
        await removeIconBtn.trigger('click')
        await flushPromises()

        // Im Modal bestätigen
        const confirmBtn = wrapper.findAll('.modal button').find(b => b.text().includes('CourseDetailView.removeModal.remove'))!
        await confirmBtn.trigger('click')
        await flushPromises()

        expect(mockRemoveMember).toHaveBeenCalledWith('c-123', 'u-99')
        expect(mockToastSuccess).toHaveBeenCalledWith('CourseDetailView.toasts.memberRemoved')

        // Prüfen, ob das Modal geschlossen wurde
        expect(wrapper.find('.modal').exists()).toBe(false)
    })
})