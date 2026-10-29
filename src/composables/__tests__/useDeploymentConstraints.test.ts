import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDeploymentConstraints, type VersionShape } from '@/composables/useDeploymentConstraints'
import type { App } from '@/types'

const makeApp = (name: string): App => ({
  name,
  appId: 'test-id',
  userId: 'user-id',
  is_private: false,
  description: null,
  git_link: null,
  created_at: '2026-01-01T00:00:00Z',
  hidden_by_admin: false,
  recommended: false,
})

const withVersion = (app: App, version: VersionShape) =>
  renderHook(() => useDeploymentConstraints(app, version)).result.current

describe('useDeploymentConstraints', () => {
  it('returns null when no version is given', () => {
    const { forcedGroupMode, groupModeReason } = renderHook(() =>
      useDeploymentConstraints(makeApp('Ubuntu'))).result.current
    expect(forcedGroupMode).toBeNull()
    expect(groupModeReason).toBeNull()
  })

  it('scope user forces one team per person', () => {
    const { forcedGroupMode, groupModeReason } = withVersion(makeApp('Ubuntu'), { runtime: 'kubernetes', scope: 'user' })
    expect(forcedGroupMode).toBe('eachUser')
    expect(groupModeReason).toBe('deployment.assignment.perPersonConstraintText')
  })

  it('scope user sets the per-person title', () => {
    expect(withVersion(makeApp('Ubuntu'), { runtime: 'kubernetes', scope: 'user' }).groupModeTitle).toBe(
      'deployment.assignment.perPersonConstraintTitle',
    )
  })

  it('scope team leaves the grouping free', () => {
    const { forcedGroupMode, groupModeReason } = withVersion(makeApp('Windows Lab'), { runtime: 'kubernetes', scope: 'team' })
    expect(forcedGroupMode).toBeNull()
    expect(groupModeReason).toBeNull()
  })

  it('null scope on a kubernetes app leaves the grouping free', () => {
    expect(withVersion(makeApp('Windows Tools'), { runtime: 'kubernetes', scope: null }).forcedGroupMode).toBeNull()
  })

  it('reacts to the version changing', () => {
    const { result, rerender } = renderHook(({ version }) => useDeploymentConstraints(makeApp('Ubuntu'), version), {
      initialProps: { version: { runtime: 'kubernetes', scope: 'team' } as VersionShape },
    })
    expect(result.current.forcedGroupMode).toBeNull()
    rerender({ version: { runtime: 'kubernetes', scope: 'user' } })
    expect(result.current.forcedGroupMode).toBe('eachUser')
  })
})
