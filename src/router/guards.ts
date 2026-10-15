import i18n from '@/i18n'
import { useAuthStore } from '@/stores/auth.store'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import type { UserRole } from '@/types'
import { paths } from './paths'

export interface RouteMeta {
  requiresAuth?: boolean
  requiresGuest?: boolean
  requiresRole?: UserRole[]
}

/**
 * Global navigation guard (the former ``router.beforeEach``).
 *
 * Resolves to the path to redirect to, or ``null`` when navigation may
 * proceed. Kept free of router types so it is trivially testable and can be
 * called from any route ``loader``.
 *
 * @param fullPath path + search of the target, used as ``returnUrl``.
 */
export async function resolveRouteGuard(meta: RouteMeta, fullPath: string): Promise<string | null> {
  let auth = useAuthStore.getState()

  if (auth.isLoading) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    auth = useAuthStore.getState()
  }

  const pathname = fullPath.split('?')[0]
  if (!auth.user && pathname !== paths.callback && pathname !== paths.login) {
    await auth.initialize()
    auth = useAuthStore.getState()
  }

  if (meta.requiresGuest && auth.isAuthenticated) {
    return paths.dashboard
  }

  if (meta.requiresAuth && !auth.isAuthenticated) {
    return `${paths.login}?returnUrl=${encodeURIComponent(fullPath)}`
  }

  const roles = meta.requiresRole
  if (roles && roles.length > 0 && !auth.hasAnyRole(...roles)) {
    // Show a toast naming the required role, then send the user to the
    // dedicated /forbidden route so refresh + history stay clean.
    try {
      const names = roles.map((r) => i18n.t(`roleLabels.${r}`)).join(', ')
      useToastStore.getState().error(i18n.t('router.forbidden', { roles: names }))
    } catch {
      // Toast/i18n not available (e.g. very early boot) — hard fallback so
      // the redirect still happens.
    }
    return paths.forbidden
  }

  return null
}

/**
 * Guard for the wizard steps. Prevents deep-links that skip the wizard state
 * model (e.g. ``/deployment/new/summary`` without an app selected). When fields
 * are missing, the guard redirects to the matching earlier step.
 *
 * Accepted fields:
 *  - ``appId``      → present = string, otherwise back to the apps overview
 *  - ``name``       → non-empty string
 *  - ``studentIds`` → at least 1 entry
 */
export type WizardField = 'appId' | 'name' | 'studentIds'

export function requireWizardStep(required: WizardField[]): string | null {
  const draft = useDeploymentStore.getState().draft
  for (const field of required) {
    const val = (draft as unknown as Record<string, unknown>)[field]
    if (field === 'studentIds') {
      // No students, nothing to do → step 1.
      if (!Array.isArray(val) || val.length === 0) return paths.deploymentConfig
    } else if (field === 'appId') {
      // No app, no wizard entry point → back to the apps list.
      if (!val) return paths.apps
    } else if (typeof val !== 'string' || val.trim() === '') {
      return paths.deploymentConfig
    }
  }
  return null
}
