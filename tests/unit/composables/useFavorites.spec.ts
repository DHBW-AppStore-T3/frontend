import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFavorites } from '@/composables/useFavorites'

describe('useFavorites', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts empty and toggles favorites, persisting per account', () => {
    const { result } = renderHook(() => useFavorites('u-1'))
    expect(result.current.favorites).toEqual([])

    act(() => result.current.toggleFavorite('a'))
    act(() => result.current.toggleFavorite('b'))
    expect(result.current.favorites).toEqual(['a', 'b'])
    expect(JSON.parse(localStorage.getItem('appstore.favorites.u-1')!)).toEqual(['a', 'b'])

    act(() => result.current.toggleFavorite('a'))
    expect(result.current.favorites).toEqual(['b'])
  })

  it('loads stored favorites and ignores non-string entries', () => {
    localStorage.setItem('appstore.favorites.u-1', JSON.stringify(['x', 5, 'y']))
    const { result } = renderHook(() => useFavorites('u-1'))
    expect(result.current.favorites).toEqual(['x', 'y'])
  })

  it('switches the list when the account changes', () => {
    localStorage.setItem('appstore.favorites.u-1', JSON.stringify(['one']))
    localStorage.setItem('appstore.favorites.u-2', JSON.stringify(['two']))
    const { result, rerender } = renderHook(({ id }) => useFavorites(id), {
      initialProps: { id: 'u-1' as string | null },
    })
    expect(result.current.favorites).toEqual(['one'])

    rerender({ id: 'u-2' })
    expect(result.current.favorites).toEqual(['two'])

    rerender({ id: null })
    expect(result.current.favorites).toEqual([])
  })

  it('falls back to session-only when storage is blocked', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    const { result } = renderHook(() => useFavorites('u-1'))

    act(() => result.current.toggleFavorite('a'))
    expect(result.current.favorites).toEqual(['a'])

    getItem.mockRestore()
    setItem.mockRestore()
  })
})
