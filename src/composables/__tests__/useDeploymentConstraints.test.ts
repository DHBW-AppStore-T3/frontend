import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDeploymentConstraints } from '@/composables/useDeploymentConstraints'
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
})
