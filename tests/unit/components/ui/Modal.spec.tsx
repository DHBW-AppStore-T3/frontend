import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '@/components/ui/Modal'

describe('Modal', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders nothing when show is false', () => {
    const { container } = render(<Modal show={false} onClose={() => {}}>Body</Modal>)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders header, falling back to title, falling back to "Modal"', () => {
    const { unmount } = render(<Modal show onClose={() => {}} header="Header Slot" />)
    expect(screen.getByText('Header Slot')).toBeInTheDocument()
    unmount()

    const second = render(<Modal show onClose={() => {}} title="Title Slot" />)
    expect(screen.getByText('Title Slot')).toBeInTheDocument()
    second.unmount()

    render(<Modal show onClose={() => {}} />)
    expect(screen.getByText('Modal')).toBeInTheDocument()
  })

  it('renders children (or body) and an optional footer', () => {
    render(
      <Modal show onClose={() => {}} footer="Footer content">
        Body content
      </Modal>,
    )
    expect(screen.getByText('Body content')).toBeInTheDocument()
    expect(screen.getByText('Footer content')).toBeInTheDocument()
  })

  it('prefers the body prop over children', () => {
    render(
      <Modal show onClose={() => {}} body="From body">
        From children
      </Modal>,
    )
    expect(screen.getByText('From body')).toBeInTheDocument()
    expect(screen.queryByText('From children')).not.toBeInTheDocument()
  })

  it('omits the footer container when no footer is given', () => {
    const { container } = render(<Modal show onClose={() => {}}>Body</Modal>)
    expect(container.querySelector('.bg-gray-50')).toBeNull()
  })

  it('calls onClose on backdrop click and on the close button, but not on panel clicks', async () => {
    const onClose = vi.fn()
    const { container } = render(<Modal show onClose={onClose}>Body</Modal>)

    await userEvent.click(screen.getByText('Body'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(container.firstElementChild as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('locks body scroll while open via useOverlay', () => {
    render(<Modal show onClose={() => {}}>Body</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
  })

  it('closes on Escape via useOverlay', () => {
    const onClose = vi.fn()
    render(<Modal show onClose={onClose}>Body</Modal>)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalled()
  })
})
