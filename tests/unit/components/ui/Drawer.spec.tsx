import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Drawer from '@/components/ui/Drawer'

const panel = (c: HTMLElement) => c.querySelector('[data-drawer-panel]') as HTMLElement

describe('Drawer', () => {
  afterEach(() => {
    document.body.style.overflow = ''
  })

  it('renders nothing when show is false', () => {
    const { container } = render(<Drawer show={false} onClose={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('defaults to sliding in from the left', () => {
    const { container } = render(<Drawer show onClose={() => {}} />)
    expect(panel(container).className).toContain('left-0')
  })

  it('slides in from the right when side="right"', () => {
    const { container } = render(<Drawer show side="right" onClose={() => {}} />)
    expect(panel(container).className).toContain('right-0')
  })

  it('renders children', () => {
    render(<Drawer show onClose={() => {}}>Drawer content</Drawer>)
    expect(screen.getByText('Drawer content')).toBeInTheDocument()
  })

  it('calls onClose on backdrop click only', async () => {
    const onClose = vi.fn()
    const { container } = render(<Drawer show onClose={onClose}>Inside</Drawer>)

    await userEvent.click(screen.getByText('Inside'))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(container.firstElementChild as HTMLElement)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape and locks scroll while open (via useOverlay)', () => {
    const onClose = vi.fn()
    render(<Drawer show onClose={onClose} />)
    expect(document.body.style.overflow).toBe('hidden')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalled()
  })
})
