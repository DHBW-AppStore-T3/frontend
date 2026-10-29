import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toast from '@/components/ui/Toast'
import { useToastStore } from '@/stores/toast.store'

// The message also lives in a live region for screen readers (#154); the specs
// below are about the visible toast.
const MESSAGE = { selector: '.toast-message' }

describe('Toast', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('renders toasts from the store with their type class', () => {
    render(<Toast />)
    act(() => {
      useToastStore.getState().success('Saved', 999999)
      useToastStore.getState().error('Boom', 999999)
    })

    expect(screen.getByText('Saved', MESSAGE).closest('.toast')).toHaveClass('toast-success')
    expect(screen.getByText('Boom', MESSAGE).closest('.toast')).toHaveClass('toast-error')
  })

  it('is mounted in document.body (portal)', () => {
    const { container } = render(<Toast />)
    act(() => {
      useToastStore.getState().info('Hi', 999999)
    })
    expect(container.querySelector('.toast-container')).toBeNull()
    expect(document.body.querySelector('.toast-container')).not.toBeNull()
  })

  it('removes a toast when it or its close button is clicked', async () => {
    render(<Toast />)
    act(() => {
      useToastStore.getState().info('First', 999999)
      useToastStore.getState().info('Second', 999999)
    })

    await userEvent.click(screen.getByText('First', MESSAGE))
    expect(screen.queryByText('First')).not.toBeInTheDocument()

    const second = screen.getByText('Second', MESSAGE).closest('.toast') as HTMLElement
    await userEvent.click(second.querySelector('.toast-close') as HTMLElement)
    expect(screen.queryByText('Second')).not.toBeInTheDocument()
  })
})
