import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toast from '@/components/ui/Toast'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../../helpers/render'

// Toast accessibility (#154, phase 1B): a named close button, a live region per
// message that fits its urgency, and no doubled announcements.

const LONG = 999999

const show = () => renderWithProviders(<Toast />)
const closeButtons = () => screen.queryAllByRole('button', { name: 'toast.close' })
const post = (fn: (s: ReturnType<typeof useToastStore.getState>) => void) => act(() => fn(useToastStore.getState()))

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Toast: close button', () => {
  it('has an accessible name on every toast', () => {
    show()
    post((s) => {
      s.info('One', LONG)
      s.error('Two', LONG)
    })
    expect(closeButtons()).toHaveLength(2)
  })

  it('hides the decorative icons from assistive technology', () => {
    show()
    post((s) => s.success('Saved', LONG))
    const toast = screen.getByText('Saved').closest('.toast') as HTMLElement
    const icons = toast.querySelectorAll('svg')
    expect(icons.length).toBeGreaterThan(0)
    icons.forEach((icon) => expect(icon).toHaveAttribute('aria-hidden', 'true'))
  })

  it('closes with Enter and with Space, leaving the other toasts', async () => {
    show()
    post((s) => {
      s.info('First', LONG)
      s.info('Second', LONG)
      s.info('Third', LONG)
    })

    await userEvent.tab()
    expect(closeButtons()[0]).toHaveFocus()
    await userEvent.keyboard('{Enter}')
    expect(screen.queryByText('First')).not.toBeInTheDocument()

    closeButtons()[0].focus()
    await userEvent.keyboard(' ')
    expect(screen.queryByText('Second')).not.toBeInTheDocument()
    expect(screen.getByText('Third')).toBeInTheDocument()
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['Third'])
  })

  it('closes by mouse through the button as well', async () => {
    show()
    post((s) => s.info('Only', LONG))
    await userEvent.click(screen.getByRole('button', { name: 'toast.close' }))
    expect(screen.queryByText('Only')).not.toBeInTheDocument()
  })
})

describe('Toast: live regions', () => {
  it('announces errors and warnings assertively as alerts', () => {
    show()
    post((s) => {
      s.error('Boom', LONG)
      s.warning('Careful', LONG)
    })
    const alerts = screen.getAllByRole('alert')
    expect(alerts.map((a) => a.textContent)).toEqual(['Boom', 'Careful'])
  })

  it('announces success and info politely as status', () => {
    show()
    post((s) => {
      s.success('Saved', LONG)
      s.info('FYI', LONG)
    })
    const statuses = screen.getAllByRole('status')
    expect(statuses.map((a) => a.textContent)).toEqual(['Saved', 'FYI'])
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('announces only the message, not the close button', () => {
    show()
    post((s) => s.error('Boom', LONG))
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(/^Boom$/)
    expect(within(alert).queryByRole('button')).toBeNull()
  })

  it('has exactly one live region per toast and none on the container', () => {
    show()
    post((s) => {
      s.success('A', LONG)
      s.error('B', LONG)
      s.info('C', LONG)
    })
    const container = document.body.querySelector('.toast-container') as HTMLElement
    expect(container).not.toHaveAttribute('role')
    expect(container).not.toHaveAttribute('aria-live')
    expect(container.querySelectorAll('[role="status"], [role="alert"], [aria-live]')).toHaveLength(3)
  })
})

describe('Toast: lifetime and click behaviour stay', () => {
  it('removes a toast after its duration, others later', () => {
    vi.useFakeTimers()
    show()
    post((s) => {
      s.info('Short', 1000)
      s.info('Default')
    })
    expect(screen.getByText('Short')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.queryByText('Short')).not.toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText('Default')).not.toBeInTheDocument()
  })

  it('still closes when the toast itself is clicked (mouse shortcut for the button)', async () => {
    show()
    post((s) => s.info('Click me', LONG))
    await userEvent.click(screen.getByText('Click me'))
    expect(screen.queryByText('Click me')).not.toBeInTheDocument()
  })
})
