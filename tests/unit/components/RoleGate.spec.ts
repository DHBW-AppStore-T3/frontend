import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import RoleGate from '@/components/RoleGate.vue'

const mocks = vi.hoisted(() => ({ isAdmin: { value: false }, isStaff: { value: false } }))

vi.mock('@/composables/useRole', () => ({
  useRole: () => ({ isAdmin: mocks.isAdmin, isStaff: mocks.isStaff }),
}))

function mountGate(props: Record<string, unknown> = {}) {
  return mount(RoleGate, { props, slots: { default: '<span>secret</span>' } })
}

beforeEach(() => {
  mocks.isAdmin.value = false
  mocks.isStaff.value = false
})

describe('RoleGate', () => {
  it('renders the slot when no restriction is given', () => {
    // Vue Test Utils defaults unset optional booleans to `false` rather than
    // `undefined` (unlike a real template, where an absent attribute is
    // `undefined`). Pass them explicitly to exercise the real "no restriction"
    // path through the component's props.
    expect(mountGate({ admin: undefined, staff: undefined, can: undefined }).text()).toBe('secret')
  })

  it('hides the slot for admin-only content when the user is not an admin', () => {
    mocks.isAdmin.value = false
    expect(mountGate({ admin: true }).text()).toBe('')
  })

  it('shows the slot for admin-only content when the user is an admin', () => {
    mocks.isAdmin.value = true
    expect(mountGate({ admin: true }).text()).toBe('secret')
  })

  it('hides staff-only content for non-staff users', () => {
    mocks.isStaff.value = false
    expect(mountGate({ staff: true }).text()).toBe('')
  })

  it('shows staff-only content for staff users', () => {
    mocks.isStaff.value = true
    expect(mountGate({ staff: true }).text()).toBe('secret')
  })

  it('respects an explicit can=false capability check', () => {
    expect(mountGate({ can: false }).text()).toBe('')
  })

  it('respects an explicit can=true capability check', () => {
    expect(mountGate({ can: true }).text()).toBe('secret')
  })

  it('prioritizes the admin prop over staff/can when multiple are set', () => {
    mocks.isAdmin.value = true
    expect(mountGate({ admin: true, can: false }).text()).toBe('secret')
  })
})
