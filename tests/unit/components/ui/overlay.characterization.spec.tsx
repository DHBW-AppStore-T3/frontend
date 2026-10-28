import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '@/components/ui/Modal'
import Drawer from '@/components/ui/Drawer'
import { useOverlay } from '@/composables/useOverlay'

// Characterisation of the overlay behaviour as it was BEFORE the dialog
// semantics were added (#140): focus, keyboard and the rendered title variants.
// It stayed green across that change except where the change is the point (no
// ARIA before, nothing focusable); those cases moved to dialog-a11y.spec.tsx.

const pressEscape = () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

function tab(shift = false) {
  const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, cancelable: true })
  act(() => {
    document.dispatchEvent(event)
  })
  return event
}

afterEach(() => {
  document.body.style.overflow = ''
})

describe('Modal: focus and keyboard (characterisation)', () => {
  it('moves focus to the first focusable element, the close button, on open', () => {
    render(
      <Modal show onClose={() => {}} title="T">
        <input aria-label="field" />
      </Modal>,
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))
  })

  it('wraps Tab from the last focusable element to the first and Shift+Tab back', () => {
    render(
      <Modal show onClose={() => {}} title="T" footer={<button>Save</button>}>
        <input aria-label="field" />
      </Modal>,
    )
    const close = screen.getByRole('button', { name: 'Close' })
    const save = screen.getByRole('button', { name: 'Save' })

    save.focus()
    expect(tab().defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(close)

    expect(tab(true).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(save)
  })

  it('returns focus to the element that opened it', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Modal show={open} onClose={() => setOpen(false)} title="T">
            Body
          </Modal>
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole('button', { name: 'Open' })
    await userEvent.click(opener)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }))

    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('Body')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('renders the header slot, then the title, then a fallback, and the header wins', () => {
    const first = render(<Modal show onClose={() => {}} header="H" title="T" />)
    expect(screen.getByText('H')).toBeInTheDocument()
    expect(screen.queryByText('T')).not.toBeInTheDocument()
    first.unmount()

    const second = render(<Modal show onClose={() => {}} header={<h2>Heading</h2>} />)
    expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument()
    second.unmount()

    render(<Modal show onClose={() => {}} />)
    expect(screen.getByText('Modal')).toBeInTheDocument()
  })

  it('renders nothing in the document while closed', () => {
    render(<Modal show={false} onClose={() => {}} title="T" />)
    expect(screen.queryByText('T')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })
})

describe('Drawer: focus and keyboard (characterisation)', () => {
  it('moves focus to the first focusable child on open and wraps Tab', () => {
    render(
      <Drawer show onClose={() => {}}>
        <a href="#a">A</a>
        <a href="#b">B</a>
      </Drawer>,
    )
    const a = screen.getByRole('link', { name: 'A' })
    const b = screen.getByRole('link', { name: 'B' })
    expect(document.activeElement).toBe(a)

    b.focus()
    expect(tab().defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(a)
  })
})

describe('useOverlay: edge cases (characterisation)', () => {
  function Overlay({ label, onClose }: { label: string; onClose: () => void }) {
    const { containerRef } = useOverlay({ show: true, onClose })
    return (
      <div ref={containerRef} tabIndex={-1} data-testid={label}>
        {label === 'with-button' ? <button>inside</button> : null}
      </div>
    )
  }

  // Before #140 focus stayed on the opener and Tab left the overlay; that is
  // fixed, the new behaviour is pinned here and in dialog-a11y.spec.tsx.
  it('keeps focus on the panel and traps Tab when the overlay has nothing focusable', () => {
    render(<Overlay label="empty" onClose={() => {}} />)
    const panel = screen.getByTestId('empty')
    expect(document.activeElement).toBe(panel)
    expect(tab().defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(panel)
  })

  it('lets every open overlay handle Escape (stacked overlays all close)', () => {
    let closedA = 0
    let closedB = 0
    render(
      <>
        <Overlay label="with-button" onClose={() => closedA++} />
        <Overlay label="empty" onClose={() => closedB++} />
      </>,
    )
    pressEscape()
    expect([closedA, closedB]).toEqual([1, 1])
  })
})
