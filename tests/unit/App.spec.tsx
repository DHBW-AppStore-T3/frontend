import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'

const mocks = vi.hoisted(() => ({
  auth: {
    user: { userId: 'u', role: 'student' },
    isLoading: false,
    isAuthenticated: true,
    initialize: vi.fn(),
    hasAnyRole: () => true,
  },
}))

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel(mocks.auth),
    { getState: () => mocks.auth },
  ),
}))

vi.mock('@/views/AppsView', () => ({ default: () => <p>apps</p> }))

import App from '@/App'
import { appRoutes } from '@/router'

vi.mock('@/router', async (orig) => {
  const mod = await orig<typeof import('@/router')>()
  return {
    ...mod,
    createAppRouter: () => createMemoryRouter(mod.appRoutes, { initialEntries: ['/apps'] }),
  }
})

describe('App', () => {
  it('provides the router and renders the matched layout and the Toast host', async () => {
    expect(appRoutes.length).toBeGreaterThan(0)
    render(<App />)

    await waitFor(() => expect(document.querySelector('.app-shell')).not.toBeNull())
    expect(document.body.querySelector('.toast-container')).not.toBeNull()
  })
})
