import { describe, it, expect } from 'vitest'
import { ref } from 'vue'
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

describe('useDeploymentConstraints', () => {
  it('returns eachUser for a Windows app', () => {
    const { forcedGroupMode, groupModeReason } = useDeploymentConstraints(makeApp('Windows Server 2022'))
    expect(forcedGroupMode.value).toBe('eachUser')
    expect(groupModeReason.value).toBeTruthy()
  })

  it('returns null for a non-Windows app', () => {
    const { forcedGroupMode, groupModeReason } = useDeploymentConstraints(makeApp('Ubuntu 22.04'))
    expect(forcedGroupMode.value).toBeNull()
    expect(groupModeReason.value).toBeNull()
  })

  it('handles null app gracefully', () => {
    const { forcedGroupMode, groupModeReason } = useDeploymentConstraints(null)
    expect(forcedGroupMode.value).toBeNull()
    expect(groupModeReason.value).toBeNull()
  })

  it('is case-insensitive', () => {
    const { forcedGroupMode } = useDeploymentConstraints(makeApp('WINDOWS 10'))
    expect(forcedGroupMode.value).toBe('eachUser')
  })

  it('reacts to ref changes', () => {
    const appRef = ref<App | null>(makeApp('Ubuntu'))
    const { forcedGroupMode } = useDeploymentConstraints(appRef)
    expect(forcedGroupMode.value).toBeNull()
    appRef.value = makeApp('Windows 11')
    expect(forcedGroupMode.value).toBe('eachUser')
    appRef.value = makeApp('Debian')
    expect(forcedGroupMode.value).toBeNull()
  })
})
