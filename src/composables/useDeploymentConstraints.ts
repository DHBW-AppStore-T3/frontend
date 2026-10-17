import { useMemo } from 'react'
import type { App } from '@/types'

export function useDeploymentConstraints(app: App | null): {
  forcedGroupMode: 'eachUser' | null
  groupModeReason: string | null
} {
  return useMemo(() => {
    const forcedGroupMode = app?.name.toLowerCase().includes('windows') ? 'eachUser' : null
    const groupModeReason =
      forcedGroupMode !== null ? 'deployment.assignment.windowsConstraintText' : null
    return { forcedGroupMode, groupModeReason }
  }, [app])
}
