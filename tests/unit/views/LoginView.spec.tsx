import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: false }), subscribe: () => () => {} },
}))

import LoginView from '@/views/LoginView'
import { useAuthStore } from '@/stores/auth.store'
import i18n from '@/i18n'
import de from '@/i18n/locales/de'
import { renderWithProviders } from '../../helpers/render'

const login = vi.fn()

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderView(route = '/login', authenticated = false) {
  useAuthStore.setState({ isAuthenticated: authenticated, login } as any)
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/login" element={<LoginView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route, realI18n: true },
  )
}

beforeEach(async () => {
  login.mockReset()
  await i18n.changeLanguage('de')
})

describe('LoginView', () => {
  it('renders the Keycloak login call to action', () => {
    renderView()
    expect(screen.getByText(de.auth.login.keycloakInfo)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: de.auth.login.keycloakButton })).toBeInTheDocument()
    expect(screen.getByText(de.auth.login.noAccount)).toBeInTheDocument()
  })

  it('redirects to the dashboard immediately when already authenticated', () => {
    renderView('/login', true)
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard')
  })

  it('redirects to the returnUrl query param when already authenticated', () => {
    renderView('/login?returnUrl=/apps', true)
    expect(screen.getByTestId('where')).toHaveTextContent('/apps')
  })

  it('does not redirect when not authenticated', () => {
    renderView()
    expect(screen.getByTestId('where')).toHaveTextContent('/login')
  })

  it('starts the Keycloak login flow with the default return url on click', async () => {
    login.mockResolvedValue(undefined)
    renderView()
    await userEvent.click(screen.getByRole('button'))
    expect(login).toHaveBeenCalledWith('/dashboard')
  })

  it('passes the returnUrl query param through to login()', async () => {
    login.mockResolvedValue(undefined)
    renderView('/login?returnUrl=/apps/42')
    await userEvent.click(screen.getByRole('button'))
    expect(login).toHaveBeenCalledWith('/apps/42')
  })

  it.each(['https://evil.example', '//evil.example', `/${String.fromCharCode(92)}evil.example`, 'javascript:alert(1)'])(
    'ignores the foreign returnUrl %s (#147)',
    async (foreign) => {
      login.mockResolvedValue(undefined)
      renderView(`/login?returnUrl=${encodeURIComponent(foreign)}`)
      await userEvent.click(screen.getByRole('button'))
      expect(login).toHaveBeenCalledWith('/dashboard')
    },
  )

  it('does not forward an authenticated user to a foreign returnUrl', () => {
    renderView(`/login?returnUrl=${encodeURIComponent('//evil.example')}`, true)
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard')
  })

  it('swallows a failed login redirect instead of throwing', async () => {
    login.mockRejectedValue(new Error('keycloak unreachable'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderView()
    await userEvent.click(screen.getByRole('button'))
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })
})
