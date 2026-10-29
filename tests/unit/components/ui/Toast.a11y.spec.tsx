import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, act, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Toast from '@/components/ui/Toast'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../../helpers/render'

// Toast accessibility (#154, phase 1B): a named close button and announcements
// through two live regions (polite, assertive) that exist before any message.
// A live region that is inserted together with its text is not reliably
// announced, so the regions are permanent and only their content changes.
//
// These specs check the DOM contract. They do not prove that a screen reader
// speaks the message: that needs a manual check with NVDA/JAWS/VoiceOver.

const LONG = 999999

const show = () => renderWithProviders(<Toast />)
const status = () => screen.getByTestId('toast-live-polite')
const alertRegion = () => screen.getByTestId('toast-live-assertive')
/** Visible toast text, not the copy in the live regions. */
const visible = (text: string) => screen.queryByText(text, { selector: '.toast-message' })
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
    const toast = visible('Saved')!.closest('.toast') as HTMLElement
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
    expect(visible('First')).not.toBeInTheDocument()

    closeButtons()[0].focus()
    await userEvent.keyboard(' ')
    expect(visible('Second')).not.toBeInTheDocument()
    expect(visible('Third')).toBeInTheDocument()
    expect(useToastStore.getState().toasts.map((t) => t.message)).toEqual(['Third'])
  })

  it('closes by mouse through the button as well', async () => {
    show()
    post((s) => s.info('Only', LONG))
    await userEvent.click(screen.getByRole('button', { name: 'toast.close' }))
    expect(visible('Only')).not.toBeInTheDocument()
  })
})

describe('Toast: live regions', () => {
  it('has a polite and an assertive region from the start, both empty', () => {
    show()
    expect(status()).toBeEmptyDOMElement()
    expect(alertRegion()).toBeEmptyDOMElement()
    expect(status()).toHaveAttribute('aria-live', 'polite')
    expect(alertRegion()).toHaveAttribute('aria-live', 'assertive')
    expect(status()).toHaveAttribute('aria-atomic', 'false')
    expect(alertRegion()).toHaveAttribute('aria-atomic', 'false')
  })

  it('fills the existing regions afterwards instead of inserting new ones', () => {
    show()
    const polite = status()
    const assertive = alertRegion()
    const changes: string[] = []
    const watch = (name: string, el: HTMLElement) =>
      new MutationObserver((records) => records.forEach((r) => r.addedNodes.length && changes.push(name))).observe(el, {
        childList: true,
      })
    watch('status', polite)
    watch('alert', assertive)

    post((s) => {
      s.info('FYI', LONG)
      s.error('Boom', LONG)
    })

    expect(status()).toBe(polite)
    expect(alertRegion()).toBe(assertive)
    expect(polite).toHaveTextContent(/^FYI$/)
    expect(assertive).toHaveTextContent(/^Boom$/)
    return Promise.resolve().then(() => expect(changes.sort()).toEqual(['alert', 'status']))
  })

  it('announces success and info politely, error and warning assertively', () => {
    show()
    post((s) => {
      s.success('Saved', LONG)
      s.info('FYI', LONG)
      s.error('Boom', LONG)
      s.warning('Careful', LONG)
    })
    expect(Array.from(status().children).map((c) => c.textContent)).toEqual(['Saved', 'FYI'])
    expect(Array.from(alertRegion().children).map((c) => c.textContent)).toEqual(['Boom', 'Careful'])
  })

  it('announces a later message without repeating the earlier ones (additions only)', () => {
    show()
    post((s) => s.success('One', LONG))
    expect(status()).toHaveAttribute('aria-relevant', 'additions')
    post((s) => s.success('Two', LONG))
    expect(Array.from(status().children).map((c) => c.textContent)).toEqual(['One', 'Two'])
  })

  it('takes a message out of its region when the toast goes away', async () => {
    show()
    post((s) => s.error('Boom', LONG))
    await userEvent.click(screen.getByRole('button', { name: 'toast.close' }))
    expect(alertRegion()).toBeEmptyDOMElement()
  })

  it('gives the visible toast no live role of its own: one announcement per message', () => {
    show()
    post((s) => {
      s.success('A', LONG)
      s.error('B', LONG)
      s.info('C', LONG)
    })
    const container = document.body.querySelector('.toast-container') as HTMLElement
    expect(container.querySelectorAll('[role], [aria-live]')).toHaveLength(0)
    expect(document.body.querySelectorAll('[role="status"], [role="alert"], [aria-live]')).toHaveLength(2)
  })

  it('adds no alert or status role to the page: real alerts stay unambiguous', () => {
    show()
    post((s) => {
      s.error('Boom', LONG)
      s.info('FYI', LONG)
    })
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('keeps the close button out of the announced text', () => {
    show()
    post((s) => s.error('Boom', LONG))
    expect(within(alertRegion()).queryByRole('button')).toBeNull()
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
    expect(visible('Short')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(visible('Short')).not.toBeInTheDocument()
    expect(visible('Default')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(visible('Default')).not.toBeInTheDocument()
    expect(status()).toBeEmptyDOMElement()
  })

  it('still closes when the toast itself is clicked (mouse shortcut for the button)', async () => {
    show()
    post((s) => s.info('Click me', LONG))
    await userEvent.click(visible('Click me')!)
    expect(visible('Click me')).not.toBeInTheDocument()
  })
})
