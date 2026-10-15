import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { useOverlay } from '@/composables/useOverlay'

function Host({ show, onClose }: { show: boolean; onClose: () => void }) {
  const { containerRef } = useOverlay({ show, onClose })
  return show ? (
    <div ref={containerRef} tabIndex={-1}>
      <button id="first">first</button>
      <button id="second">second</button>
    </div>
  ) : null
}

describe('useOverlay', () => {
  let trigger: HTMLButtonElement

  beforeEach(() => {
    trigger = document.createElement('button')
    trigger.id = 'trigger'
    document.body.appendChild(trigger)
    trigger.focus()
    document.body.style.overflow = ''
  })

  afterEach(() => {
    trigger.remove()
    document.body.style.overflow = ''
  })

  it('calls onClose on Escape while open', () => {
    let closed = false
    render(<Host show onClose={() => { closed = true }} />)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closed).toBe(true)
  })

  it('does not react to Escape while closed', () => {
    let closed = false
    render(<Host show={false} onClose={() => { closed = true }} />)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closed).toBe(false)
  })

  it('locks body scroll while open and releases it on close', () => {
    const { rerender } = render(<Host show onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')

    rerender(<Host show={false} onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('')
  })

  it('releases the scroll lock on unmount while open', () => {
    const { unmount } = render(<Host show onClose={() => {}} />)
    expect(document.body.style.overflow).toBe('hidden')

    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('moves focus into the container on open', () => {
    render(<Host show onClose={() => {}} />)
    expect(document.activeElement?.id).toBe('first')
  })

  it('traps Tab inside the container', () => {
    render(<Host show onClose={() => {}} />)
    const second = document.getElementById('second')!
    second.focus()

    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    act(() => {
      document.dispatchEvent(event)
    })

    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement?.id).toBe('first')
  })

  it('returns focus to the previously focused element on close', () => {
    const { rerender } = render(<Host show onClose={() => {}} />)

    rerender(<Host show={false} onClose={() => {}} />)
    expect(document.activeElement).toBe(trigger)
  })

  it('uses the latest onClose without re-subscribing', () => {
    const calls: string[] = []
    const { rerender } = render(<Host show onClose={() => calls.push('a')} />)
    rerender(<Host show onClose={() => calls.push('b')} />)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(calls).toEqual(['b'])
  })
})
