import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as any,
    isLoading: false,
    isAuthenticated: false,
    initialize: vi.fn(),
    hasAnyRole: vi.fn(),
  },
  draft: { appId: null as string | null, name: '', studentIds: [] as string[] },
  toastError: vi.fn(),
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: { getState: () => mocks.auth },
}))
vi.mock('@/stores/deployment.store', () => ({
  useDeploymentStore: { getState: () => ({ draft: mocks.draft }) },
}))
vi.mock('@/stores/toast.store', () => ({
  useToastStore: { getState: () => ({ error: mocks.toastError }) },
}))

import { resolveRouteGuard, requireWizardStep } from '@/router/guards'

beforeEach(() => {
  mocks.auth.user = null
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = false
  mocks.auth.initialize.mockReset().mockResolvedValue(undefined)
  mocks.auth.hasAnyRole.mockReset().mockReturnValue(true)
  mocks.draft = { appId: null, name: '', studentIds: [] }
  mocks.toastError.mockReset()
})

describe('resolveRouteGuard', () => {
  it('initialises the auth store when there is no user yet', async () => {
    await resolveRouteGuard({}, '/apps')
    expect(mocks.auth.initialize).toHaveBeenCalled()
  })

  it('does not initialise on /login and /callback', async () => {
    await resolveRouteGuard({}, '/login')
    await resolveRouteGuard({}, '/callback')
    expect(mocks.auth.initialize).not.toHaveBeenCalled()
  })

  it('does not initialise when a user is already present', async () => {
    mocks.auth.user = { userId: 'u' }
    await resolveRouteGuard({}, '/apps')
    expect(mocks.auth.initialize).not.toHaveBeenCalled()
  })

  it('redirects authenticated users away from guest-only routes to the dashboard', async () => {
    mocks.auth.isAuthenticated = true
    expect(await resolveRouteGuard({ requiresGuest: true }, '/login')).toBe('/dashboard')
  })

  it('lets guests into guest-only routes', async () => {
    expect(await resolveRouteGuard({ requiresGuest: true }, '/login')).toBeNull()
  })

  it('redirects unauthenticated users to /login with the encoded return url', async () => {
    expect(await resolveRouteGuard({ requiresAuth: true }, '/deployments/abc?tab=logs')).toBe(
      `/login?returnUrl=${encodeURIComponent('/deployments/abc?tab=logs')}`,
    )
  })

  it('allows authenticated users on protected routes', async () => {
    mocks.auth.isAuthenticated = true
    expect(await resolveRouteGuard({ requiresAuth: true }, '/apps')).toBeNull()
  })

  it('redirects to /forbidden with a toast naming the roles when the role is missing', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.hasAnyRole.mockReturnValue(false)

    const to = await resolveRouteGuard({ requiresAuth: true, requiresRole: ['admin'] }, '/admin/apps')

    expect(to).toBe('/forbidden')
    expect(mocks.auth.hasAnyRole).toHaveBeenCalledWith('admin')
    expect(mocks.toastError).toHaveBeenCalledTimes(1)
  })

  it('still redirects to /forbidden if the toast cannot be shown', async () => {
    mocks.auth.isAuthenticated = true
    mocks.auth.hasAnyRole.mockReturnValue(false)
    mocks.toastError.mockImplementation(() => {
      throw new Error('toast down')
    })

    expect(await resolveRouteGuard({ requiresRole: ['admin'] }, '/admin/apps')).toBe('/forbidden')
  })

  it('allows a matching role', async () => {
    mocks.auth.isAuthenticated = true
    expect(await resolveRouteGuard({ requiresRole: ['teacher', 'admin'] }, '/courses')).toBeNull()
  })

  it('waits for an in-flight auth load before deciding', async () => {
    vi.useFakeTimers()
    mocks.auth.isLoading = true
    mocks.auth.isAuthenticated = true
    const pending = resolveRouteGuard({ requiresAuth: true }, '/apps')
    await vi.advanceTimersByTimeAsync(100)
    expect(await pending).toBeNull()
    vi.useRealTimers()
  })
})

describe('requireWizardStep', () => {
  it('sends users without an app back to the apps list', () => {
    expect(requireWizardStep(['appId'])).toBe('/apps')
  })

  it('sends users without a name to step 1', () => {
    mocks.draft = { appId: 'a', name: '   ', studentIds: ['s'] }
    expect(requireWizardStep(['appId', 'name'])).toBe('/deployment/new/config')
  })

  it('sends users without students to step 1', () => {
    mocks.draft = { appId: 'a', name: 'n', studentIds: [] }
    expect(requireWizardStep(['appId', 'name', 'studentIds'])).toBe('/deployment/new/config')
  })

  it('lets a complete draft through', () => {
    mocks.draft = { appId: 'a', name: 'n', studentIds: ['s'] }
    expect(requireWizardStep(['appId', 'name', 'studentIds'])).toBeNull()
  })
})
