import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useClipboard } from '../useClipboard'

describe('useClipboard', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('writes via navigator.clipboard and exposes the key for a short time', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    const { result } = renderHook(() => useClipboard(1000))

    await act(async () => {
      await result.current.copy('secret', 'pw')
    })

    expect(writeText).toHaveBeenCalledWith('secret')
    expect(result.current.copiedKey).toBe('pw')

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.copiedKey).toBeNull()
  })

  it('does nothing for empty text', async () => {
    const writeText = vi.fn()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('', 'k')
    })

    expect(writeText).not.toHaveBeenCalled()
    expect(result.current.copiedKey).toBeNull()
  })

  it('falls back to execCommand without a secure context', async () => {
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true })
    const exec = vi.fn(() => true)
    ;(document as any).execCommand = exec
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('x', 'k')
    })

    expect(exec).toHaveBeenCalledWith('copy')
    expect(result.current.copiedKey).toBe('k')
  })

  it('swallows clipboard errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(() => Promise.reject(new Error('denied'))) },
      configurable: true,
    })
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true })
    const { result } = renderHook(() => useClipboard())

    await act(async () => {
      await result.current.copy('x', 'k')
    })

    expect(result.current.copiedKey).toBeNull()
    expect(err).toHaveBeenCalled()
  })
})
