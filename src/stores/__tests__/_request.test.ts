import { describe, it, expect } from 'vitest'
import { runRequest } from '../_request'

function makeSlice() {
  const state = { isLoading: false, error: 'old' as string | null }
  const log: boolean[] = []
  const set = (patch: Partial<typeof state>) => {
    Object.assign(state, patch)
    if (patch.isLoading !== undefined) log.push(patch.isLoading)
  }
  return { state, set, log }
}

describe('runRequest', () => {
  it('toggles loading, clears the error and returns the result', async () => {
    const { state, set, log } = makeSlice()
    const result = await runRequest(set, async () => {
      expect(state.isLoading).toBe(true)
      expect(state.error).toBeNull()
      return 42
    }, 'fallback')

    expect(result).toBe(42)
    expect(state.isLoading).toBe(false)
    expect(log).toEqual([true, false])
  })

  it('stores the extracted message and rethrows by default', async () => {
    const { state, set } = makeSlice()
    await expect(
      runRequest(set, () => Promise.reject({ response: { data: { detail: 'nope' } } }), 'fallback'),
    ).rejects.toBeDefined()
    expect(state.error).toBe('nope')
    expect(state.isLoading).toBe(false)
  })

  it('swallows the error with { rethrow: false } and resolves undefined', async () => {
    const { state, set } = makeSlice()
    const result = await runRequest(set, () => Promise.reject(new Error('x')), 'fallback', {
      rethrow: false,
    })
    expect(result).toBeUndefined()
    expect(state.error).toBeTruthy()
    expect(state.isLoading).toBe(false)
  })
})
