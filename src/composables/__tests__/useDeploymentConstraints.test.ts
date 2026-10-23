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
  releaseTag: '1.0.0',
})

const run = (app: App | null) => renderHook(() => useDeploymentConstraints(app)).result.current

describe('useDeploymentConstraints', () => {
  it('returns eachUser for a Windows app', () => {
    const { forcedGroupMode, groupModeReason } = run(makeApp('Windows Server 2022'))
    expect(forcedGroupMode).toBe('eachUser')
    expect(groupModeReason).toBeTruthy()
  })

  it('returns null for a non-Windows app', () => {
    const { forcedGroupMode, groupModeReason } = run(makeApp('Ubuntu 22.04'))
    expect(forcedGroupMode).toBeNull()
    expect(groupModeReason).toBeNull()
  })

  it('handles null app gracefully', () => {
    const { forcedGroupMode, groupModeReason } = run(null)
    expect(forcedGroupMode).toBeNull()
    expect(groupModeReason).toBeNull()
  })

  it('is case-insensitive', () => {
    expect(run(makeApp('WINDOWS 10')).forcedGroupMode).toBe('eachUser')
  })

  it('follows the app across re-renders', () => {
    const { result, rerender } = renderHook(({ app }) => useDeploymentConstraints(app), {
      initialProps: { app: makeApp('Ubuntu') as App | null },
    })
    expect(result.current.forcedGroupMode).toBeNull()
    rerender({ app: makeApp('Windows 11') })
    expect(result.current.forcedGroupMode).toBe('eachUser')
    rerender({ app: makeApp('Debian') })
    expect(result.current.forcedGroupMode).toBeNull()
  })

  describe('with the runtime and scope of the version (appstore.yaml)', () => {
    const withVersion = (app: App, version: VersionShape) =>
      renderHook(() => useDeploymentConstraints(app, version)).result.current

    it('scope user forces one team per person, whatever the name', () => {
      const { forcedGroupMode, groupModeReason } = withVersion(makeApp('Ubuntu'), { runtime: 'kubernetes', scope: 'user' })
      expect(forcedGroupMode).toBe('eachUser')
      expect(groupModeReason).toBe('deployment.assignment.perPersonConstraintText')
    })

    it('names the licence in the heading only where the licence is the reason', () => {
      expect(withVersion(makeApp('Ubuntu'), { runtime: 'kubernetes', scope: 'user' }).groupModeTitle).toBe(
        'deployment.assignment.perPersonConstraintTitle',
      )
      expect(withVersion(makeApp('Windows 11'), { runtime: 'openstack-vm', scope: null }).groupModeTitle).toBe(
        'deployment.assignment.windowsConstraintTitle',
      )
      expect(withVersion(makeApp('Ubuntu'), { runtime: 'kubernetes', scope: 'team' }).groupModeTitle).toBeNull()
    })

    it('scope team leaves the grouping free, even for a "Windows" name', () => {
      const { forcedGroupMode, groupModeReason } = withVersion(makeApp('Windows Lab'), { runtime: 'openstack-vm', scope: 'team' })
      expect(forcedGroupMode).toBeNull()
      expect(groupModeReason).toBeNull()
    })

    it('a pod app is never grouped by its name', () => {
      expect(withVersion(makeApp('Windows Tools'), { runtime: 'kubernetes', scope: null }).forcedGroupMode).toBeNull()
    })

    it('only a VM app without a scope falls back to the name rule', () => {
      const { forcedGroupMode, groupModeReason } = withVersion(makeApp('Windows 11'), { runtime: 'openstack-vm', scope: null })
      expect(forcedGroupMode).toBe('eachUser')
      expect(groupModeReason).toBe('deployment.assignment.windowsConstraintText')
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
})
