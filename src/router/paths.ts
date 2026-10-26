/**
 * Central route table of path builders. Replaces vue-router's named routes
 * (``{ name: 'deployments.detail', params: { id } }``): links and navigations
 * use these helpers, so a path only ever lives in one place.
 */
export const paths = {
  home: '/',
  dashboard: '/dashboard',
  login: '/login',
  callback: '/callback',
  forbidden: '/forbidden',
  help: '/help',
  courses: '/courses',
  course: (id: string) => `/courses/${id}`,
  apps: '/apps',
  appCreate: '/apps/create',
  app: (id: string) => `/apps/${id}`,
  deployments: '/deployments',
  deployment: (id: string) => `/deployments/${id}`,
  deploymentConfig: '/deployment/new/config',
  deploymentTeams: '/deployment/new/teams',
  deploymentVariables: '/deployment/new/variables',
  deploymentSummary: '/deployment/new/summary',
  adminApps: '/admin/apps',
  adminSettings: '/admin/settings',
  user: '/user',
} as const
