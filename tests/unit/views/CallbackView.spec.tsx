import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, act } from '@testing-library/react'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: false }), subscribe: () => () => {} },
}))

import CallbackView from '@/views/CallbackView'
import { useAuthStore } from '@/stores/auth.store'
import { renderWithProviders } from '../../helpers/render'

const handleCallback = vi.fn()

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

function renderView() {
  useAuthStore.setState({ handleCallback } as any)
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/callback" element={<CallbackView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/callback' },
  )
}

beforeEach(() => {
  handleCallback.mockReset()
})

describe('CallbackView', () => {
  it('shows a spinner while the callback is in flight', () => {
    handleCallback.mockReturnValue(new Promise(() => {}))
    renderView()
    expect(screen.getByText('Completing authentication...')).toBeInTheDocument()
  })

  it('redirects to the resolved return url on success', async () => {
    handleCallback.mockResolvedValue('/apps/7')
    renderView()
    expect(await screen.findByText('elsewhere')).toBeInTheDocument()
    expect(screen.getByTestId('where')).toHaveTextContent('/apps/7')
  })

  it('falls back to the dashboard when no return url is resolved', async () => {
    handleCallback.mockResolvedValue(undefined)
    renderView()
    await screen.findByText('elsewhere')
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard')
  })

  describe('on failure', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('shows the error message and redirects to /login after a delay', async () => {
      handleCallback.mockRejectedValue(new Error('invalid state'))
      renderView()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })

      expect(screen.getByText('Authentication Error')).toBeInTheDocument()
      expect(screen.getByText('invalid state')).toBeInTheDocument()
      expect(screen.getByTestId('where')).toHaveTextContent('/callback')

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000)
      })
      expect(screen.getByTestId('where')).toHaveTextContent('/login')
    })

    it('falls back to a generic message when the error has none', async () => {
      handleCallback.mockRejectedValue({})
      renderView()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByText('Authentication failed')).toBeInTheDocument()
    })
  })
})
