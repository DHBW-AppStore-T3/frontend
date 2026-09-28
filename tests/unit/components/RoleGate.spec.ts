import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

// ---------------------------------------------------------------------------
// Mock useRole so tests can control isAdmin / isStaff without Keycloak
// ---------------------------------------------------------------------------
const mockIsAdmin = ref(false)
const mockIsStaff = ref(false)

vi.mock('@/composables/useRole', () => ({
  useRole: () => ({ isAdmin: mockIsAdmin, isStaff: mockIsStaff }),
}))

import RoleGate from '@/components/RoleGate.vue'

beforeEach(() => {
  mockIsAdmin.value = false
  mockIsStaff.value = false
})

const SLOT_TEXT = 'Protected content'
const slot = { default: SLOT_TEXT }

describe('RoleGate.vue', () => {
  it('no props → always renders the slot (open by default)', () => {
    const wrapper = mount(RoleGate, { slots: slot })
    expect(wrapper.text()).toContain(SLOT_TEXT)
  })

  it('admin prop + isAdmin=true → renders slot', () => {
    mockIsAdmin.value = true
    const wrapper = mount(RoleGate, { props: { admin: true }, slots: slot })
    expect(wrapper.text()).toContain(SLOT_TEXT)
  })

  it('admin prop + isAdmin=false → hides slot', () => {
    mockIsAdmin.value = false
    const wrapper = mount(RoleGate, { props: { admin: true }, slots: slot })
    expect(wrapper.text()).not.toContain(SLOT_TEXT)
  })

  it('staff prop + isStaff=true → renders slot', () => {
    mockIsStaff.value = true
    const wrapper = mount(RoleGate, { props: { staff: true }, slots: slot })
    expect(wrapper.text()).toContain(SLOT_TEXT)
  })

  it('staff prop + isStaff=false → hides slot', () => {
    mockIsStaff.value = false
    const wrapper = mount(RoleGate, { props: { staff: true }, slots: slot })
    expect(wrapper.text()).not.toContain(SLOT_TEXT)
  })

  it('can=true → renders slot', () => {
    const wrapper = mount(RoleGate, { props: { can: true }, slots: slot })
    expect(wrapper.text()).toContain(SLOT_TEXT)
  })

  it('can=false → hides slot', () => {
    const wrapper = mount(RoleGate, { props: { can: false }, slots: slot })
    expect(wrapper.text()).not.toContain(SLOT_TEXT)
  })

  it('admin prop wins over staff prop when both are set', () => {
    // admin is the first if-branch; staff is second — admin wins
    mockIsAdmin.value = true
    mockIsStaff.value = false
    const wrapper = mount(RoleGate, { props: { admin: true, staff: true }, slots: slot })
    expect(wrapper.text()).toContain(SLOT_TEXT)
  })

  it('admin prop=false, staff=true, isStaff=true → staff branch renders', () => {
    mockIsAdmin.value = false
    mockIsStaff.value = true
    // admin prop is NOT set (undefined/falsy), so admin branch is skipped; staff branch runs
    const wrapper = mount(RoleGate, { props: { staff: true }, slots: slot })
    expect(wrapper.text()).toContain(SLOT_TEXT)
  })

  it('isAdmin changing reactively shows slot without remount', async () => {
    mockIsAdmin.value = false
    const wrapper = mount(RoleGate, { props: { admin: true }, slots: slot })
    expect(wrapper.text()).not.toContain(SLOT_TEXT)

    mockIsAdmin.value = true
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain(SLOT_TEXT)
  })
})
