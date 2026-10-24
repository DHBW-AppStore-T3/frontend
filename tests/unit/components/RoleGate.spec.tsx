import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import RoleGate from '@/components/RoleGate'

const mocks = vi.hoisted(() => ({ isAdmin: false, isStaff: false, isAdminView: false }))

vi.mock('@/composables/useRole', () => ({
  useRole: () => ({ isAdmin: mocks.isAdmin, isStaff: mocks.isStaff, isAdminView: mocks.isAdminView }),
}))

function gate(props: { admin?: boolean; staff?: boolean; can?: boolean; adminView?: boolean } = {}) {
  return render(
    <RoleGate {...props}>
      <span>secret</span>
    </RoleGate>,
  ).container.textContent
}

beforeEach(() => {
  mocks.isAdmin = false
  mocks.isStaff = false
  mocks.isAdminView = false
})

describe('RoleGate', () => {
  it('renders the children when no restriction is given', () => {
    expect(gate()).toBe('secret')
  })

  it('hides admin-only content when the user is not an admin', () => {
    expect(gate({ admin: true })).toBe('')
  })

  it('shows admin-only content when the user is an admin', () => {
    mocks.isAdmin = true
    expect(gate({ admin: true })).toBe('secret')
  })

  it('hides staff-only content for non-staff users', () => {
    expect(gate({ staff: true })).toBe('')
  })

  it('shows staff-only content for staff users', () => {
    mocks.isStaff = true
    expect(gate({ staff: true })).toBe('secret')
  })

  it('respects an explicit can=false capability check', () => {
    expect(gate({ can: false })).toBe('')
  })

  it('respects an explicit can=true capability check', () => {
    expect(gate({ can: true })).toBe('secret')
  })

  it('prioritizes the admin prop over staff/can when multiple are set', () => {
    mocks.isAdmin = true
    expect(gate({ admin: true, can: false })).toBe('secret')
  })

  it('hides adminView content while the admin view is off', () => {
    mocks.isAdmin = true
    expect(gate({ adminView: true })).toBe('')
  })

  it('shows adminView content when the admin view is on', () => {
    mocks.isAdminView = true
    expect(gate({ adminView: true })).toBe('secret')
  })
})
