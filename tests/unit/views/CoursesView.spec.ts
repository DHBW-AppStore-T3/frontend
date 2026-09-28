import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick, ref } from 'vue'

import CoursesView from '@/views/CoursesView.vue'

// ---------------------------------------------------------
// 1. Mocks & Setup
// ---------------------------------------------------------

// Router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
    useRouter: () => ({ push: mockPush })
}))

// i18n - HIER KORRIGIERT: Beachtet jetzt Variablen!
vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string, vars?: any) => vars ? `${key} ${JSON.stringify(vars)}` : key
    })
}))

// Toast
const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()
vi.mock('@/composables/useToast', () => ({
    useToast: () => ({ error: mockToastError, success: mockToastSuccess })
}))

// Rechteverwaltung (Permissions) flexibel mocken
const mockCan = {
    createCourse: { value: true },
    editCourse: { value: true },
    deleteCourse: { value: true }
}
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

// API (Mitgliederanzahl)
vi.mock('@/api/course.api', () => ({
    courseApi: { listMembers: vi.fn() }
}))
import { courseApi } from '@/api/course.api'

// Course Store (Pinia)
const mockFetchCourses = vi.fn()
const mockCreateCourse = vi.fn()
const mockDeleteCourse = vi.fn()
let mockCourses: any[] = []
let mockIsLoading = false

vi.mock('@/stores/course.store', () => ({
    useCourseStore: () => ({
        get courses() { return mockCourses },
        get isLoading() { return mockIsLoading },
        fetchCourses: mockFetchCourses,
        createCourse: mockCreateCourse,
        deleteCourse: mockDeleteCourse
    })
}))

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

describe('CoursesView.vue', () => {

    beforeEach(() => {
        vi.clearAllMocks()

        // Standard-Zustand für Tests zurücksetzen
        mockCourses = []
        mockIsLoading = false
        mockCan.createCourse.value = true
        mockCan.editCourse.value = true
        mockCan.deleteCourse.value = true
        mockIsStaff.value = true

        mockFetchCourses.mockResolvedValue(undefined)
    })

    const mountComponent = () => {
        return mount(CoursesView, {
            global: {
                // HIER KORRIGIERT: Beachtet jetzt Variablen im Template!
                mocks: {
                    $t: (key: string, vars?: any) => vars ? `${key} ${JSON.stringify(vars)}` : key
                },
                stubs: {
                    Card: { template: '<div class="stub-card" @click="$emit(\'click\')"><slot /></div>' },
                    BaseButton: { template: '<button><slot /></button>' },
                    BaseInput: {
                        props: ['modelValue'],
                        template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
                    },
                    Modal: {
                        props: ['show'],
                        template: '<div v-if="$props.show" class="modal"><slot name="header" /><slot name="body" /><slot name="footer" /></div>'
                    }
                }
            }
        })
    }

    // --- 1. Lade- und Leerzustände ---

    it('zeigt den Loading-Text, wenn Daten geladen werden', () => {
        mockIsLoading = true
        const wrapper = mountComponent()

        expect(wrapper.text()).toContain('CoursesView.loading')
    })

    it('zeigt den Empty-State, wenn keine Kurse existieren', async () => {
        const wrapper = mountComponent()
        await flushPromises()

        expect(wrapper.text()).toContain('CoursesView.noCourses')
        expect(wrapper.text()).toContain('CoursesView.createFirst')
    })

    it('zeigt einen Fehler-Toast, wenn das Laden der Kurse fehlschlägt', async () => {
        mockFetchCourses.mockRejectedValue(new Error('Network error'))
        mountComponent()
        await flushPromises()

        expect(mockToastError).toHaveBeenCalledWith('CoursesView.toasts.loadError')
    })

    // --- 2. Daten anzeigen & Mitglieder laden ---

    it('rendert Kurse und holt die Mitgliederanzahl', async () => {
        mockCourses = [
            { courseId: 'c-1', name: 'Vue JS Kurs' },
            { courseId: 'c-2', name: 'Python Kurs' }
        ]

        ;(courseApi.listMembers as any).mockImplementation((id: string) => {
            if (id === 'c-1') return Promise.resolve({ data: ['user1', 'user2'] })
            return Promise.reject(new Error('Keine Rechte'))
        })

        const wrapper = mountComponent()
        await flushPromises()

        expect(wrapper.text()).toContain('Vue JS Kurs')
        expect(wrapper.text()).toContain('Python Kurs')

        expect(wrapper.text()).toContain('2 CoursesView.memberPlural')
        expect(wrapper.text()).toContain('0 CoursesView.memberPlural')
    })

    it('navigiert zur Detailseite, wenn ein Kurs geklickt wird', async () => {
        mockCourses = [{ courseId: 'c-99', name: 'Klick Test' }]
        ;(courseApi.listMembers as any).mockResolvedValue({ data: [] })

        const wrapper = mountComponent()
        await flushPromises()

        const card = wrapper.find('.stub-card')
        await card.trigger('click')

        expect(mockPush).toHaveBeenCalledWith({ path: '/courses/c-99' })
    })

    // --- 3. Rechteverwaltung (Permissions) ---

    it('versteckt die "Erstellen" Buttons, wenn die Rechte fehlen', async () => {
        mockCan.createCourse.value = false
        mockIsStaff.value = false
        const wrapper = mountComponent()
        await flushPromises()

        expect(wrapper.text()).not.toContain('CoursesView.newCourse')
        expect(wrapper.text()).not.toContain('CoursesView.createFirst')
    })

    it('versteckt den Löschen-Button und die Mitgliederanzahl, wenn edit-Rechte fehlen', async () => {
        mockCourses = [{ courseId: 'c-1', name: 'Test Kurs' }]
        mockCan.editCourse.value = false
        mockCan.deleteCourse.value = true
        mockIsStaff.value = false

        const wrapper = mountComponent()
        await flushPromises()

        expect(courseApi.listMembers).not.toHaveBeenCalled()
        expect(wrapper.find('button[title="CoursesView.deleteTitle"]').exists()).toBe(false)
        expect(wrapper.text()).not.toContain('CoursesView.memberPlural')
    })

    // --- 4. Erstellen (Modal & API) ---

    it('öffnet das Erstellen-Modal und speichert einen neuen Kurs erfolgreich', async () => {
        mockCreateCourse.mockResolvedValue({ courseId: 'new-c-1' })

        const wrapper = mountComponent()
        await flushPromises()

        const createBtn = wrapper.findAll('button').find(b => b.text().includes('CoursesView.newCourse'))!
        await createBtn.trigger('click')
        await nextTick()

        const input = wrapper.find('input')
        await input.setValue('Mein neuer Kurs')

        const saveBtn = wrapper.findAll('.modal button').find(b => b.text().includes('CoursesView.createModal.create'))!
        await saveBtn.trigger('click')
        await flushPromises()

        expect(mockCreateCourse).toHaveBeenCalledWith({ name: 'Mein neuer Kurs' })
        expect(mockToastSuccess).toHaveBeenCalledWith('CoursesView.toasts.createSuccess')
        expect(mockPush).toHaveBeenCalledWith('/courses/new-c-1')
    })

    it('zeigt einen Fehler an, wenn das Erstellen fehlschlägt', async () => {
        mockCreateCourse.mockRejectedValue({ response: { data: { detail: 'Backend Error' } } })

        const wrapper = mountComponent()
        await flushPromises()

        ;(wrapper.vm as any).formData.name = 'Fail Kurs'
        ;(wrapper.vm as any).saveCourse()
        await flushPromises()

        expect(mockToastError).toHaveBeenCalledWith('Backend Error')
    })

    // --- 5. Löschen (Modal & API) ---

    it('öffnet das Löschen-Modal und löscht den Kurs erfolgreich', async () => {
        mockCourses = [{ courseId: 'c-77', name: 'Zu löschender Kurs' }]
        ;(courseApi.listMembers as any).mockResolvedValue({ data: [] })
        mockDeleteCourse.mockResolvedValue(undefined)

        const wrapper = mountComponent()
        await flushPromises()

        const deleteBtn = wrapper.find('button[title="CoursesView.deleteTitle"]')
        await deleteBtn.trigger('click')
        await nextTick()

        const modal = wrapper.find('.modal')
        expect(modal.text()).toContain('Zu löschender Kurs')

        const confirmBtn = wrapper.findAll('.modal button').find(b => b.text().includes('CoursesView.deleteModal.delete'))!
        await confirmBtn.trigger('click')
        await flushPromises()

        expect(mockDeleteCourse).toHaveBeenCalledWith('c-77')
        expect(mockToastSuccess).toHaveBeenCalledWith('CoursesView.toasts.deleteSuccess')
        expect((wrapper.vm as any).courseToDelete).toBeNull()
    })
})