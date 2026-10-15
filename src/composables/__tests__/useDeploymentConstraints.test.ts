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

  describe('with the runtime and scope of the version (appstore.yaml)', () => {
    it('scope user forces one team per person, whatever the name', () => {
      const { forcedGroupMode, groupModeReason } = useDeploymentConstraints(makeApp('Ubuntu'), { runtime: 'kubernetes', scope: 'user' })
      expect(forcedGroupMode.value).toBe('eachUser')
      expect(groupModeReason.value).toBe('deployment.assignment.perPersonConstraintText')
    })

    it('scope team leaves the grouping free, even for a "Windows" name', () => {
      const { forcedGroupMode, groupModeReason } = useDeploymentConstraints(makeApp('Windows Lab'), { runtime: 'openstack-vm', scope: 'team' })
      expect(forcedGroupMode.value).toBeNull()
      expect(groupModeReason.value).toBeNull()
    })

    it('a pod app is never grouped by its name', () => {
      const { forcedGroupMode } = useDeploymentConstraints(makeApp('Windows Tools'), { runtime: 'kubernetes', scope: null })
      expect(forcedGroupMode.value).toBeNull()
    })

    it('only a VM app without a scope falls back to the name rule', () => {
      const { forcedGroupMode, groupModeReason } = useDeploymentConstraints(makeApp('Windows 11'), { runtime: 'openstack-vm', scope: null })
      expect(forcedGroupMode.value).toBe('eachUser')
      expect(groupModeReason.value).toBe('deployment.assignment.windowsConstraintText')
    })

    it('reacts to the version changing', () => {
      const version = ref<{ runtime: 'kubernetes' | 'openstack-vm'; scope: 'team' | 'user' | null }>({ runtime: 'kubernetes', scope: 'team' })
      const { forcedGroupMode } = useDeploymentConstraints(makeApp('Ubuntu'), version)
      expect(forcedGroupMode.value).toBeNull()
      version.value = { runtime: 'kubernetes', scope: 'user' }
      expect(forcedGroupMode.value).toBe('eachUser')
    })
  })
})
