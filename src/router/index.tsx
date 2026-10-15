import type { ComponentType } from 'react'
import { createBrowserRouter, Outlet, redirect, type RouteObject } from 'react-router'
import AuthLayout from '@/layouts/AuthLayout'
import AppLayout from '@/layouts/AppLayout'
import UserLayout from '@/layouts/UserLayout'
import Toast from '@/components/ui/Toast'
import NotMigratedView from '@/views/NotMigratedView'
import type { UserRole } from '@/types'
import { paths } from './paths'
import { resolveRouteGuard, requireWizardStep, type RouteMeta, type WizardField } from './guards'

/** Lazy-load a view's default export (code-splitting, like the old `() => import(...)`). */
const lazyView = (load: () => Promise<{ default: ComponentType }>) => async () => ({
  Component: (await load()).default,
})

/** Temporary stand-in for views that are not ported yet. */
const notMigrated = (name: string) => async () => ({
  Component: () => <NotMigratedView name={name} />,
})

/**
 * Route with the navigation guards attached as a `loader`:
 * global auth/role guard first, then an optional wizard-step guard.
 */
function guarded(
  route: RouteObject,
  meta: RouteMeta,
  wizard?: WizardField[],
): RouteObject {
  return {
    ...route,
    loader: async ({ request }) => {
      const url = new URL(request.url)
      const to = await resolveRouteGuard(meta, url.pathname + url.search)
      if (to) throw redirect(to)
      if (wizard) {
        const step = requireWizardStep(wizard)
        if (step) throw redirect(step)
      }
      return null
    },
  }
}

const auth: RouteMeta = { requiresAuth: true }
const wizardFields: WizardField[] = ['appId', 'name', 'studentIds']

export const appRoutes: RouteObject[] = [
  {
    // Root: global overlays that live outside every layout (the old App.vue).
    // Guards run in loaders; render nothing while the first one is pending.
    HydrateFallback: () => null,
    element: (
      <>
        <Outlet />
        <Toast />
      </>
    ),
    children: [
      // AUTH LAYOUT
      {
        element: <AuthLayout />,
        children: [
          guarded({ path: 'login', lazy: lazyView(() => import('@/views/LoginView')) }, { requiresGuest: true }),
          guarded({ path: 'callback', lazy: lazyView(() => import('@/views/CallbackView')) }, {}),
        ],
      },

      // APP LAYOUT
      {
        element: <AppLayout />,
        children: [
          guarded({ index: true, lazy: lazyView(() => import('@/views/DashboardView')) }, auth),
          guarded({ path: 'dashboard', lazy: lazyView(() => import('@/views/DashboardView')) }, auth),
          guarded(
            { path: 'courses', lazy: lazyView(() => import('@/views/CoursesView')) },
            { requiresAuth: true, requiresRole: ['teacher', 'admin'] as UserRole[] },
          ),
          guarded(
            { path: 'courses/:id', lazy: lazyView(() => import('@/views/CourseDetailView')) },
            { requiresAuth: true, requiresRole: ['teacher', 'admin'] as UserRole[] },
          ),
          guarded({ path: 'apps', lazy: lazyView(() => import('@/views/AppsView')) }, auth),
          guarded({ path: 'apps/create', lazy: notMigrated('AddAppsView') }, auth),
          guarded({ path: 'apps/:id', lazy: notMigrated('AppsDetailView') }, auth),
          guarded({ path: 'help', lazy: lazyView(() => import('@/views/HelpView')) }, auth),
          guarded(
            {
              path: 'deployments',
              lazy: lazyView(() => import('@/views/DeploymentsView')),
              children: [
                { index: true, lazy: lazyView(() => import('@/views/DeploymentsListView')) },
                { path: ':id', lazy: lazyView(() => import('@/views/DeploymentDetailView')) },
              ],
            },
            auth,
          ),
          guarded({ path: 'deployment/new/config', lazy: notMigrated('NewDeploymentConfigView') }, auth),
          guarded(
            { path: 'deployment/new/teams', lazy: notMigrated('NewDeploymentGroupsAssignmentView') },
            auth,
            wizardFields,
          ),
          guarded(
            { path: 'deployment/new/variables', lazy: notMigrated('NewDeploymentVariableView') },
            auth,
            wizardFields,
          ),
          guarded(
            { path: 'deployment/new/summary', lazy: notMigrated('NewDeploymentSummaryView') },
            auth,
            wizardFields,
          ),
          guarded(
            { path: 'admin/apps', lazy: notMigrated('AdminAppsView') },
            { requiresAuth: true, requiresRole: ['admin'] as UserRole[] },
          ),
          guarded({ path: 'forbidden', lazy: lazyView(() => import('@/views/ForbiddenView')) }, auth),
        ],
      },

      // USER LAYOUT
      {
        element: <UserLayout />,
        children: [
          guarded({ path: 'user', lazy: lazyView(() => import('@/views/UserView')) }, auth),
          guarded({ path: 'user/openstack', lazy: lazyView(() => import('@/views/SettingsOpenStackView')) }, auth),
        ],
      },

      { path: '*', Component: () => null, loader: () => redirect(paths.home) },
    ],
  },
]

export const createAppRouter = () => createBrowserRouter(appRoutes)

export { paths, lazyView }
