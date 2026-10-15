import { createRouter, createWebHistory } from "vue-router";
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import i18n from '@/i18n'
import CoursesView from "@/views/CoursesView.vue";
import CourseDetailView from "@/views/CourseDetailView.vue";
import AppsView from "@/views/AppsView.vue";
import HelpView from "@/views/HelpView.vue";
import DeploymentsView from "@/views/DeploymentsView.vue";
import DeploymentsListView from "@/views/DeploymentsListView.vue";
import DeploymentDetailView from "@/views/DeploymentDetailView.vue";
import LoginView from "@/views/LoginView.vue";
import DashboardView from "@/views/DashboardView.vue";
import UserView from "@/views/UserView.vue";
import AddAppsView from "@/views/AddAppsView.vue";
import { useAuthStore } from '@/stores/auth.store'
import type { UserRole } from '@/types'
import NewDeploymentConfigView from '@/views/NewDeploymentConfigView.vue';
import NewDeploymentSummaryView from '@/views/NewDeploymentSummaryView.vue';
import NewDeploymentVariableView from '@/views/NewDeploymentVariableView.vue';
import AppsDetailView from "@/views/AppsDetailView.vue";
import NewDeploymentGroupsAssignmentView from '@/views/NewDeploymentGroupsAssignmentView.vue'


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
type WizardField = 'appId' | 'name' | 'studentIds'

const STAFF: UserRole[] = ['teacher', 'admin']

function requireWizardStep(required: WizardField[]) {
  return () => {
    const draft = useDeploymentStore().draft
    for (const field of required) {
      const val = (draft as any)[field]
      if (field === 'studentIds') {
        if (!Array.isArray(val) || val.length === 0) {
          // No students, nothing to do → step 1.
          return { name: 'deployment.config' }
        }
      } else if (field === 'appId') {
        if (!val) {
          // No app, no wizard entry point → back to the apps list.
          return '/apps'
        }
      } else if (typeof val !== 'string' || val.trim() === '') {
        return { name: 'deployment.config' }
      }
    }
    return true
  }
}


const router = createRouter({
  history: createWebHistory(),
  routes: [
    // AUTH LAYOUT
    {
      path: "/login",
      component: LoginView,
      meta: { layout: "auth", requiresGuest: true },
    },
    {
      path: "/callback",
      name: "callback",
      component: () => import('@/views/CallbackView.vue'),
      meta: { layout: "auth" },
    },

    // APP LAYOUT
    {
      path: "/",
      name: "home",
      component: DashboardView,
      meta: { layout: "app", requiresAuth: true },
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardView,
      meta: { layout: "app", requiresAuth: true, useMeshBg: true },
    },
    {
      path: "/courses",
      component: CoursesView,
      meta: {
        layout: "app",
        requiresAuth: true,
        requiresRole: ['teacher', 'admin']
      },
    },
    {
      path: "/courses/:id",
      name: "courses.detail",
      component: CourseDetailView,
      meta: {
        layout: "app",
        requiresAuth: true,
        requiresRole: ['teacher', 'admin']
      },
    },
    {
      path: "/apps",
      name: "apps",
      component: AppsView,
      meta: { layout: "app", requiresAuth: true },
    },
    {
      // Teachers and admins register apps and deploy (.github#7 F); the
      // API refuses students with 403 role_required anyway.
      path: "/apps/create",
      name: "apps.create",
      component: AddAppsView,
      meta: { layout: "app", requiresAuth: true, requiresRole: STAFF },
    },
    {
      path: "/apps/:id",
      name: "apps.detail",
      component: AppsDetailView,
      meta: { layout: "app", requiresAuth: true },
    },
    {
      path: "/help",
      component: HelpView,
      meta: { layout: "app", requiresAuth: true },
    },
    {
      path: "/deployments",
      component: DeploymentsView,
      meta: { layout: "app", requiresAuth: true },
      children: [
        {
          path: '',
          name: 'deployments.list',
          component: DeploymentsListView,
        },
        {
          path: '/deployments/:id',
          name: 'deployments.detail',
          component: DeploymentDetailView,
          props: true,
        }
      ],
    },
    // User Profile
    {
      path: "/user",
      component: UserView,
      meta: { layout: "user", requiresAuth: true },
    },
    {
      path: '/deployment/new/config',
      name: 'deployment.config',
      component: NewDeploymentConfigView,
      meta: { requiresAuth: true, layout: 'app', requiresRole: STAFF }
    },
    {
      path: '/deployment/new/teams',
      name: 'deployment.teams',
      component: NewDeploymentGroupsAssignmentView,
      meta: { requiresAuth: true, layout: 'app', requiresRole: STAFF },
      // Step 2 requires step 1 (app + name + at least one student). Deep-links
      // otherwise redirect to step 1.
      beforeEnter: requireWizardStep(['appId', 'name', 'studentIds']),
    },
    {
      path: '/deployment/new/variables',
      name: 'deployment.variables',
      component: NewDeploymentVariableView,
      meta: { requiresAuth: true, layout: 'app', requiresRole: STAFF },
      // The variables step needs the team setup filled in; otherwise redirect
      // to the matching earlier step.
      beforeEnter: requireWizardStep(['appId', 'name', 'studentIds']),
    },
    {
      path: '/deployment/new/summary',
      name: 'deployment.summary',
      component: NewDeploymentSummaryView,
      meta: { requiresAuth: true, layout: 'app', requiresRole: STAFF },
      // Summary is only reachable once all previous steps have data.
      beforeEnter: requireWizardStep(['appId', 'name', 'studentIds']),
    },
    {
      path: '/admin/apps',
      name: 'admin.apps',
      component: () => import('@/views/AdminAppsView.vue'),
      meta: { requiresAuth: true, layout: 'app', requiresRole: ['admin'] as UserRole[] },
    },
    {
      // OpenStack credentials only matter for deploying VM apps (staff).
      path: '/user/openstack',
      name: 'user.openstack',
      component: () => import('@/views/SettingsOpenStackView.vue'),
      meta: { requiresAuth: true, layout: 'user', requiresRole: STAFF },
    },
    {
      path: '/forbidden',
      name: 'forbidden',
      component: () => import('@/views/ForbiddenView.vue'),
      meta: { requiresAuth: true, layout: 'app' },
    },
  ],
});

// Navigation Guards
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore()

  if (authStore.isLoading) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  if (!authStore.user && to.path !== '/callback' && to.path !== '/login') {
    await authStore.initialize()
  }

  const requiresAuth = to.meta.requiresAuth as boolean
  const requiresGuest = to.meta.requiresGuest as boolean
  const requiresRole = to.meta.requiresRole as UserRole[] | undefined

  if (requiresGuest && authStore.isAuthenticated) {
    return next('/dashboard')
  }

  if (requiresAuth && !authStore.isAuthenticated) {
    const returnUrl = to.fullPath
    return next(`/login?returnUrl=${encodeURIComponent(returnUrl)}`)
  }

  if (requiresRole && requiresRole.length > 0) {
    if (!authStore.hasAnyRole(...requiresRole)) {
      // Show a toast naming the required role, then send the user to the
      // dedicated /forbidden route so refresh + history stay clean.
      try {
        const tr = i18n.global.t
        const required = requiresRole.map((r) => tr(`roleLabels.${r}`)).join(', ')
        useToastStore().error(tr('router.forbidden', { roles: required }))
      } catch {
        // Toast/i18n not available (e.g. very early boot) — hard fallback so
        // the redirect still happens.
      }
      return next({ path: '/forbidden' })
    }
  }

  next()
})

export default router;
