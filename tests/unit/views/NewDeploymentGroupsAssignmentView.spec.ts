import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { useRouter } from 'vue-router'

// Anpassen an deinen tatsächlichen Dateinamen / Pfad
import DeploymentTeams from '@/views/NewDeploymentGroupsAssignmentView.vue' 

import { useDeploymentStore } from '@/stores/deployment.store'
import { userApi } from '@/api/user.api'

// --- MOCKS ---
vi.mock('vue-router', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn()
  }))
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: any) => {
      if (params?.index !== undefined) return `Team ${params.index}`
      return key
    }
  })
}))

vi.mock('@/api/user.api', () => ({
  userApi: {
    getById: vi.fn()
  }
}))

describe('NewDeploymentTeamsView.vue', () => {
  let routerPushMock: any
  let routerReplaceMock: any

  beforeEach(() => {
    vi.clearAllMocks()
    routerPushMock = vi.fn()
    routerReplaceMock = vi.fn()
    vi.mocked(useRouter).mockReturnValue({ 
      push: routerPushMock, 
      replace: routerReplaceMock 
    } as any)
    
    // Standard-Mock für fehlende Studenten im Cache
    vi.mocked(userApi.getById).mockResolvedValue({ 
      data: { userId: 'u3', firstName: 'Missing', lastName: 'User' } 
    } as any)
  })

  function createWrapper(customDraftState = {}) {
    const pinia = createTestingPinia({
      createSpy: vi.fn,
      initialState: {
        deployment: {
          studentCache: new Map([
            ['u1', { userId: 'u1', firstName: 'John', lastName: 'Doe' }],
            ['u2', { userId: 'u2', firstName: 'Jane', lastName: 'Smith' }]
          ]),
          draft: {
            studentIds: ['u1', 'u2'],
            groupCount: 2,
            groupNames: ['Team 1', 'Team 2'],
            assignments: [[], []],
            groupMode: 'custom',
            ...customDraftState
          }
        }
      }
    })

    return mount(DeploymentTeams, {
      global: {
        plugins: [pinia],
        stubs: {
          DeploymentProgressBar: true,
          Plus: true,
          Minus: true,
          Users: true,
          ArrowLeft: true,
          ArrowRight: true,
          GripVertical: true,
          Trash2: true,
          UserPlus: true,
          Shuffle: true,
          X: true
        }
      }
    })
  }

  it('redirects to config if no students are selected', async () => {
    createWrapper({ studentIds: [] }) // Keine Studenten
    await flushPromises()

    expect(routerReplaceMock).toHaveBeenCalledWith({ name: 'deployment.config' })
  })

  it('renders correctly with unassigned students', async () => {
    const wrapper = createWrapper()
    await flushPromises()

   
    
    // Beide Studenten sollten im Unassigned-Pool sein, da 'assignments' leer ist
    expect(wrapper.text()).toContain('John Doe')
    expect(wrapper.text()).toContain('Jane Smith')
    
    // Next-Button sollte deaktiviert sein (weil nicht alle zugewiesen sind)
    const nextBtn = wrapper.find('[data-testid="btn-next"]')
    expect(nextBtn.attributes('disabled')).toBeDefined()
  })

  it('assigns all students to one group when "One Group" mode is selected', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const store = useDeploymentStore()

    // Klick auf den "One Group" Button
    const buttons = wrapper.findAll('button')
    const oneGroupBtn = buttons.find(b => b.text() === 'deployment.groups.one')
    await oneGroupBtn?.trigger('click')

    // Prüfen, ob Store aktualisiert wurde
    expect(store.draft.groupMode).toBe('one')
    expect(store.draft.groupCount).toBe(1)
    expect(store.draft.assignments[0]).toEqual(['u1', 'u2']) // Beide im ersten Array
  })

  it('assigns one student per group when "Each User" mode is selected', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    const store = useDeploymentStore()

    // Klick auf "Each User"
    const buttons = wrapper.findAll('button')
    const eachUserBtn = buttons.find(b => b.text() === 'deployment.groups.eachUser')
    await eachUserBtn?.trigger('click')

    // Jeder in einer eigenen Gruppe
    expect(store.draft.groupMode).toBe('eachUser')
    expect(store.draft.groupCount).toBe(2)
    expect(store.draft.assignments[0]).toContain('u1')
    expect(store.draft.assignments[1]).toContain('u2')
  })

  it('increments and decrements group count correctly', async () => {
    // 3 Studenten für dieses Setup
    const wrapper = createWrapper({ studentIds: ['u1', 'u2', 'u3'] })
    await flushPromises()
    const store = useDeploymentStore()

    // Klick auf "+"
    const buttons = wrapper.findAll('button')
    const plusBtn = buttons.find(b => b.html().includes('lucide-plus'))
    
    await plusBtn?.trigger('click')
    expect(store.draft.groupCount).toBe(3)

    // Klick auf "-"
    const minusBtn = buttons.find(b => b.html().includes('lucide-minus'))
    await minusBtn?.trigger('click')
    expect(store.draft.groupCount).toBe(2)
  })

  it('removes a student from a group when clicking the X button', async () => {
    // Vorab zugewiesener Zustand
    const wrapper = createWrapper({
      assignments: [['u1', 'u2'], []],
      groupCount: 2
    })
    await flushPromises()
    const store = useDeploymentStore()

    // Finde den Remove-Button (das erste 'X' in der Drop-Zone)
    const removeBtn = wrapper.find('[data-testid="btn-remove-student"]')
    expect(removeBtn.exists()).toBe(true)
    
    await removeBtn.trigger('click')
    
    // 'u1' sollte nun nicht mehr in der Gruppe sein
    expect(store.draft.assignments[0]).not.toContain('u1')
  })

  it('enables the next button only if all students are assigned and groups are valid', async () => {
    // Zunächst unzugewiesen
    const wrapper = createWrapper({
      assignments: [[], []],
      groupCount: 2
    })
    await flushPromises()

    const nextBtn = wrapper.find('[data-testid="btn-next"]')
    expect(nextBtn.attributes('disabled')).toBeDefined()

    // Weise sie manuell im Store zu
    const store = useDeploymentStore()
    store.draft.assignments = [['u1'], ['u2']]
    
    // Erzwinge Vue-Update
    await wrapper.vm.$nextTick()

    // Button sollte jetzt aktiv sein
    expect(nextBtn.attributes('disabled')).toBeUndefined()

    // Klick test
    await nextBtn.trigger('click')
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployment.variables' })
  })

  it('navigates back on back button click', async () => {
    const wrapper = createWrapper()
    await flushPromises()

    const backBtn = wrapper.find('[data-testid="btn-back"]')
    await backBtn.trigger('click')

    expect(routerPushMock).toHaveBeenCalledWith({ name: 'deployment.config' })
  })
})