import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeploymentStream } from '../useDeploymentStream'

// The stream updates state from async network callbacks outside of act();
// disable the act environment warning for this suite.
;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = false

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
}))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getAccessToken: mocks.getAccessToken },
}))

/** Renders the hook and returns a live view onto its latest return value. */
function setup(id: string | null) {
  const { result } = renderHook(() => useDeploymentStream(id))
  return new Proxy({} as ReturnType<typeof useDeploymentStream>, {
    get: (_t, key) => (result.current as any)[key],
  })
}

/** Builds a Response-like object whose body streams the given SSE frames one chunk at a time. */
function sseResponse(frames: string[], opts: { ok?: boolean; status?: number } = {}) {
  const encoder = new TextEncoder()
  let index = 0
  const body = {
    getReader() {
      return {
        async read() {
          if (index >= frames.length) return { done: true, value: undefined }
          const chunk = encoder.encode(frames[index])
          index += 1
          return { done: false, value: chunk }
        },
      }
    },
  }
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    body,
  } as unknown as Response
}

function frame(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

async function flush(times = 5) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
  }
}

beforeEach(() => {
  mocks.getAccessToken.mockResolvedValue('token-abc')
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('useDeploymentStream', () => {
  it('does nothing when deploymentId is null', async () => {
    const stream = setup(null)
    stream.start()
    await flush()

    expect(fetch).not.toHaveBeenCalled()
    expect(stream.connectionState).toBe('idle')
  })

  it('connects with the bearer token and moves to the live state', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([]))
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/deployments/d-1/stream'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer token-abc' }) }),
    )
    expect(stream.connectionState).toBe('ended')
  })

  it('sends an empty Authorization header when no token is available', async () => {
    mocks.getAccessToken.mockResolvedValueOnce(null)
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([]))
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(fetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: '' }) }),
    )
  })

  it('adopts progress/phase from an active snapshot', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('snapshot', { task_id: 't-1', status: 'RUNNING', current_phase: 'TERRAFORM_APPLY', progress_pct: 42, type: 'deploy' })]),
    )
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(stream.progress).toBe(42)
    expect(stream.currentPhase).toBe('TERRAFORM_APPLY')
  })

  it('ignores a terminal-status snapshot progress/phase but marks the stream ended', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('snapshot', { task_id: 't-1', status: 'SUCCESS', current_phase: 'OUTPUTS_READY', progress_pct: 100, type: 'deploy' })]),
    )
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(stream.progress).toBeNull()
    expect(stream.currentPhase).toBeNull()
    expect(stream.connectionState).toBe('ended')
  })

  it('applies a progress event, including phase_names when present', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('progress', {
        phase: 'PACKER_BUILD', phase_index: 2, total_phases: 8, progress_pct: 25,
        phase_names: ['INIT', 'PACKER_BUILD', 'TERRAFORM_APPLY'],
      })]),
    )
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(stream.progress).toBe(25)
    expect(stream.currentPhase).toBe('PACKER_BUILD')
    expect(stream.currentPhaseIndex).toBe(2)
    expect(stream.totalPhases).toBe(8)
    expect(stream.phaseNames).toEqual(['INIT', 'PACKER_BUILD', 'TERRAFORM_APPLY'])
  })

  it('keeps the previous phaseNames when a progress event omits them', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        frame('progress', { phase: 'A', phase_index: 1, total_phases: 3, progress_pct: 10, phase_names: ['A', 'B', 'C'] }),
        frame('progress', { phase: 'B', phase_index: 2, total_phases: 3, progress_pct: 50 }),
      ]),
    )
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(stream.phaseNames).toEqual(['A', 'B', 'C'])
    expect(stream.currentPhase).toBe('B')
  })

  it('appends log entries and re-keys iso_timestamp to timestamp', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('log', { iso_timestamp: '2026-01-01T00:00:00Z', level: 'INFO', message: 'starting' })]),
    )
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(stream.liveLogs).toEqual([
      { iso_timestamp: '2026-01-01T00:00:00Z', timestamp: '2026-01-01T00:00:00Z', level: 'INFO', message: 'starting' },
    ])
    expect(stream.totalLogCount).toBe(1)
  })

  it('caps liveLogs at 100 entries while totalLogCount keeps growing', async () => {
    const frames = Array.from({ length: 105 }, (_, i) =>
      frame('log', { timestamp: `t-${i}`, level: 'INFO', message: `line ${i}` }),
    )
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse(frames))
    const stream = setup('d-1')

    stream.start()
    await flush(20)

    expect(stream.liveLogs).toHaveLength(100)
    expect(stream.liveLogs[0]!.message).toBe('line 5')
    expect(stream.totalLogCount).toBe(105)
  })

  it('pushes a warning log on an overflow event', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([frame('overflow', {})]))
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(stream.liveLogs).toHaveLength(1)
    expect(stream.liveLogs[0]!.level).toBe('WARNING')
    expect(stream.liveLogs[0]!.message).toContain('lagged behind')
  })

  it.each(['succeeded', 'failed', 'revoked'])('marks the connection ended on a %s event', async (eventName) => {
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([frame(eventName, {})]))
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(stream.connectionState).toBe('ended')
  })

  it('does not reconnect on a 4xx response, surfaces the error state', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([], { ok: false, status: 404 }))
    const stream = setup('d-1')

    stream.start()
    await flush()

    expect(stream.connectionState).toBe('error')
    expect(stream.lastError).toBe('HTTP 404')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('schedules a reconnect on a 5xx response', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([], { ok: false, status: 503 }))
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([]))
    const stream = setup('d-1')

    stream.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(stream.connectionState).toBe('reconnecting')

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('schedules a reconnect when fetch itself throws a non-abort error', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network down'))
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([]))
    const stream = setup('d-1')

    stream.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(stream.lastError).toBe('network down')
    expect(stream.connectionState).toBe('reconnecting')

    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it('does not reconnect when fetch rejects with an AbortError', async () => {
    vi.useFakeTimers()
    const abortErr = new DOMException('aborted', 'AbortError')
    vi.mocked(fetch).mockRejectedValueOnce(abortErr)
    const stream = setup('d-1')

    stream.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(stream.connectionState).toBe('connecting')
    await vi.advanceTimersByTimeAsync(RECONNECT_WINDOW())
    expect(fetch).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('reset() via start() clears prior state from a previous run', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('progress', { phase: 'A', phase_index: 1, total_phases: 7, progress_pct: 50 })]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()
    expect(stream.progress).toBe(50)

    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([]))
    stream.start()
    await flush()

    expect(stream.progress).toBeNull()
    expect(stream.currentPhase).toBeNull()
    expect(stream.totalPhases).toBe(11)
    expect(stream.liveLogs).toEqual([])
    expect(stream.totalLogCount).toBe(0)
  })

  it('stop() aborts the in-flight connection and marks the stream ended', async () => {
    let readCalls = 0
    const neverEndingBody = {
      getReader() {
        return {
          async read() {
            readCalls += 1
            await new Promise(() => {}) // never resolves until aborted
            return { done: true, value: undefined }
          },
        }
      },
    }
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, status: 200, body: neverEndingBody } as unknown as Response)
    const stream = setup('d-1')

    stream.start()
    await flush()
    expect(readCalls).toBeGreaterThan(0)

    act(() => stream.stop())
    expect(stream.connectionState).toBe('ended')
  })

  it('ignores an unknown event name without throwing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([frame('heartbeat', { ping: true })]))
    const stream = setup('d-1')

    expect(() => stream.start()).not.toThrow()
    await flush()
    expect(stream.connectionState).toBe('ended')
  })
  it('aborts the in-flight request and cancels reconnects when unmounted', async () => {
    let signal: AbortSignal | undefined
    vi.mocked(fetch).mockImplementationOnce(((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal
      return new Promise(() => {})
    }) as any)
    const { result, unmount } = renderHook(() => useDeploymentStream('d-1'))

    act(() => result.current.start())
    await flush()
    expect(signal?.aborted).toBe(false)

    unmount()
    expect(signal?.aborted).toBe(true)
  })
})

function RECONNECT_WINDOW() {
  return 1000
}
