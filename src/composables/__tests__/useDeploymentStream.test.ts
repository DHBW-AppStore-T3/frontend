import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useDeploymentStream } from '@/composables/useDeploymentStream'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@/composables/useKeycloak', () => ({
  useKeycloak: () => ({ getAccessToken: vi.fn().mockResolvedValue('tok-test') }),
}))

vi.mock('@/env', () => ({ env: { API_URL: 'http://api.test' } }))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const encoder = new TextEncoder()

/** Build an SSE frame string: `event: <name>\ndata: <json>` */
function sseFrame(eventName: string, data: object): string {
  return `event: ${eventName}\ndata: ${JSON.stringify(data)}`
}

/**
 * Create a ReadableStream that emits each frame followed by '\n\n'
 * (the SSE frame delimiter) and then closes.
 */
function makeSseStream(frames: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(ctrl) {
      for (const frame of frames) {
        ctrl.enqueue(encoder.encode(frame + '\n\n'))
      }
      ctrl.close()
    },
  })
}

/** Mock global fetch to return an ok response with the given SSE frames. */
function mockOkFetch(frames: string[]) {
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    status: 200,
    body: makeSseStream(frames),
  } as unknown as Response)
}

/**
 * Drain the microtask queue N times.
 * Uses queueMicrotask so it is NOT blocked by vi.useFakeTimers().
 */
async function drain(n = 8) {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => queueMicrotask(r))
  }
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.useRealTimers()
})

// ===========================================================================
// handleEvent: snapshot
// ===========================================================================
describe('handleEvent: snapshot', () => {
  it('RUNNING status → adopts progress_pct and current_phase', async () => {
    mockOkFetch([
      sseFrame('snapshot', { task_id: 't-1', status: 'running', current_phase: 'BUILD', progress_pct: 30, type: 'snapshot' }),
    ])
    const { progress, currentPhase, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(progress.value).toBe(30)
    expect(currentPhase.value).toBe('BUILD')
  })

  it('PENDING status also counts as active → adopts progress', async () => {
    mockOkFetch([
      sseFrame('snapshot', { task_id: 't-1', status: 'pending', current_phase: 'INIT', progress_pct: 0, type: 'snapshot' }),
    ])
    const { progress, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(progress.value).toBe(0)
  })

  it('SUCCESS terminal status → connectionState=ended, does NOT adopt progress', async () => {
    mockOkFetch([
      sseFrame('snapshot', { task_id: 't-1', status: 'success', current_phase: 'DONE', progress_pct: 100, type: 'snapshot' }),
    ])
    const { progress, connectionState, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(connectionState.value).toBe('ended')
    expect(progress.value).toBeNull()  // stale-task guard: must NOT adopt
  })

  it('FAILED terminal status → connectionState=ended', async () => {
    mockOkFetch([
      sseFrame('snapshot', { task_id: 't-1', status: 'failed', current_phase: null, progress_pct: null, type: 'snapshot' }),
    ])
    const { connectionState, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(connectionState.value).toBe('ended')
  })

  it('CANCELLED terminal status → connectionState=ended', async () => {
    mockOkFetch([
      sseFrame('snapshot', { task_id: 't-1', status: 'cancelled', current_phase: null, progress_pct: null, type: 'snapshot' }),
    ])
    const { connectionState, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(connectionState.value).toBe('ended')
  })
})

// ===========================================================================
// handleEvent: progress
// ===========================================================================
describe('handleEvent: progress', () => {
  it('updates all four fields: progress, phase, phaseIndex, totalPhases', async () => {
    mockOkFetch([
      sseFrame('progress', { phase: 'TERRAFORM_APPLY', phase_index: 5, total_phases: 11, progress_pct: 55 }),
    ])
    const { progress, currentPhase, currentPhaseIndex, totalPhases, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(progress.value).toBe(55)
    expect(currentPhase.value).toBe('TERRAFORM_APPLY')
    expect(currentPhaseIndex.value).toBe(5)
    expect(totalPhases.value).toBe(11)
  })

  it('updates phaseNames when event carries a non-empty phase_names array', async () => {
    const phases = ['INIT', 'TERRAFORM_PLAN', 'TERRAFORM_APPLY']
    mockOkFetch([
      sseFrame('progress', { phase: 'INIT', phase_index: 1, total_phases: 3, progress_pct: 10, phase_names: phases }),
    ])
    const { phaseNames, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(phaseNames.value).toEqual(phases)
  })

  it('does NOT overwrite phaseNames when phase_names is absent in a later event', async () => {
    const initialPhases = ['A', 'B', 'C']
    mockOkFetch([
      sseFrame('progress', { phase: 'A', phase_index: 1, total_phases: 3, progress_pct: 10, phase_names: initialPhases }),
      sseFrame('progress', { phase: 'B', phase_index: 2, total_phases: 3, progress_pct: 50 }),  // no phase_names
    ])
    const { phaseNames, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(phaseNames.value).toEqual(initialPhases)
  })

  it('does NOT overwrite phaseNames when phase_names is an empty array', async () => {
    const initialPhases = ['X', 'Y']
    mockOkFetch([
      sseFrame('progress', { phase: 'X', phase_index: 1, total_phases: 2, progress_pct: 20, phase_names: initialPhases }),
      sseFrame('progress', { phase: 'Y', phase_index: 2, total_phases: 2, progress_pct: 80, phase_names: [] }),
    ])
    const { phaseNames, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(phaseNames.value).toEqual(initialPhases)
  })
})

// ===========================================================================
// handleEvent: log
// ===========================================================================
describe('handleEvent: log', () => {
  it('re-keys iso_timestamp → timestamp for downstream consumers', async () => {
    mockOkFetch([
      sseFrame('log', { iso_timestamp: '2024-06-01T12:00:00Z', timestamp: 1717243200, level: 'INFO', message: 'Ready' }),
    ])
    const { liveLogs, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(liveLogs.value).toHaveLength(1)
    expect(liveLogs.value[0]!.timestamp).toBe('2024-06-01T12:00:00Z')
  })

  it('falls back to raw timestamp field when iso_timestamp is absent', async () => {
    mockOkFetch([
      sseFrame('log', { timestamp: '2024-06-01T12:00:00Z', level: 'WARN', message: 'Slow' }),
    ])
    const { liveLogs, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(liveLogs.value[0]!.timestamp).toBe('2024-06-01T12:00:00Z')
  })
})

// ===========================================================================
// handleEvent: overflow
// ===========================================================================
describe('handleEvent: overflow', () => {
  it('pushes a synthetic WARNING/system log entry', async () => {
    mockOkFetch([sseFrame('overflow', {})])
    const { liveLogs, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(liveLogs.value).toHaveLength(1)
    expect(liveLogs.value[0]!.level).toBe('WARNING')
    expect(liveLogs.value[0]!.category).toBe('system')
  })
})

// ===========================================================================
// handleEvent: terminal events (succeeded / failed / revoked)
// ===========================================================================
describe('handleEvent: terminal events', () => {
  it.each(['succeeded', 'failed', 'revoked'])(
    '%s → connectionState=ended',
    async (event) => {
      mockOkFetch([sseFrame(event, {})])
      const { connectionState, start } = useDeploymentStream(ref('d-1'))
      start()
      await drain()
      expect(connectionState.value).toBe('ended')
    },
  )
})

// ===========================================================================
// pushLog ring buffer
// ===========================================================================
describe('pushLog ring buffer', () => {
  it('caps liveLogs at 100 entries and keeps incrementing totalLogCount', async () => {
    // Deliver all 105 frames in ONE stream chunk so they are processed
    // synchronously inside a single buffer.split() pass — otherwise each frame
    // would need its own async reader.read() cycle, requiring 300+ drain steps.
    const allFrames =
      Array.from({ length: 105 }, (_, i) =>
        sseFrame('log', { iso_timestamp: '2024-01-01T00:00:00Z', level: 'INFO', message: `msg-${i}` }),
      ).join('\n\n') + '\n\n'

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      body: new ReadableStream<Uint8Array>({
        start(ctrl) {
          ctrl.enqueue(encoder.encode(allFrames))
          ctrl.close()
        },
      }),
    } as unknown as Response)

    const { liveLogs, totalLogCount, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain(20)
    expect(liveLogs.value).toHaveLength(100)
    expect(totalLogCount.value).toBe(105)
    // Oldest 5 were evicted; buffer window starts at msg-5
    expect(liveLogs.value[0]!.message).toBe('msg-5')
    expect(liveLogs.value[99]!.message).toBe('msg-104')
  })
})

// ===========================================================================
// parseFrame: SSE wire format parsing (via connect())
// ===========================================================================
describe('parseFrame: SSE wire format', () => {
  it('ignores keepalive comment frames (lines starting with ":")', async () => {
    // Stream: one keepalive comment, then a terminal event
    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        ctrl.enqueue(encoder.encode(': keepalive\n\n'))
        ctrl.enqueue(encoder.encode(sseFrame('succeeded', {}) + '\n\n'))
        ctrl.close()
      },
    })
    vi.mocked(global.fetch).mockResolvedValue({ ok: true, status: 200, body: stream } as unknown as Response)
    const { connectionState, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    // The succeeded event was parsed; the comment was silently skipped
    expect(connectionState.value).toBe('ended')
  })

  it('JSON-parses data and dispatches to handleEvent', async () => {
    mockOkFetch([sseFrame('progress', { phase: 'BUILD', phase_index: 2, total_phases: 8, progress_pct: 25 })])
    const { progress, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(progress.value).toBe(25)
  })
})

// ===========================================================================
// connect(): HTTP error handling
// ===========================================================================
describe('connect: HTTP error handling', () => {
  it('4xx response → connectionState=error, does not schedule retry', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 403,
      body: null,
    } as unknown as Response)
    const { connectionState, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(connectionState.value).toBe('error')
  })

  it('network TypeError → connectionState=reconnecting', async () => {
    vi.useFakeTimers()
    vi.mocked(global.fetch).mockRejectedValue(new TypeError('Network failure'))
    const { connectionState, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(connectionState.value).toBe('reconnecting')
  })

  it('AbortError (e.g. from stop()) → no reconnect scheduled', async () => {
    vi.useFakeTimers()
    const abortErr = new DOMException('Aborted', 'AbortError')
    vi.mocked(global.fetch).mockRejectedValue(abortErr)
    const { connectionState, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(connectionState.value).not.toBe('reconnecting')
    expect(connectionState.value).not.toBe('error')
  })
})

// ===========================================================================
// scheduleReconnect: exponential backoff timing
// ===========================================================================
describe('scheduleReconnect: exponential backoff', () => {
  it('first retry at 1000ms, second retry at 2000ms more', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('net'))
      .mockRejectedValueOnce(new TypeError('net'))
      .mockResolvedValue({ ok: true, status: 200, body: makeSseStream([]) } as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const { start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 999ms: too early for first retry
    vi.advanceTimersByTime(999)
    await drain()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 1ms more (1000ms total): first retry fires
    vi.advanceTimersByTime(1)
    await drain()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // 1999ms more: still not 2000ms for second retry
    vi.advanceTimersByTime(1999)
    await drain()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // 1ms more (2000ms total): second retry fires
    vi.advanceTimersByTime(1)
    await drain()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('stop() during reconnect window cancels the pending retry', async () => {
    vi.useFakeTimers()
    vi.mocked(global.fetch).mockRejectedValue(new TypeError('net'))
    const { connectionState, start, stop } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(connectionState.value).toBe('reconnecting')

    stop()
    expect(connectionState.value).toBe('ended')

    // Advance past the first retry window; no second fetch should fire
    vi.advanceTimersByTime(10_000)
    await drain()
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1)
  })

  it('scheduleReconnect is a no-op when connectionState is already "ended"', async () => {
    vi.useFakeTimers()
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: false, status: 500, body: null } as unknown as Response)
    const { connectionState, start, stop } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    // 5xx normally schedules reconnect; force-stop first
    stop()
    vi.advanceTimersByTime(10_000)
    await drain()
    // fetch called exactly once; the stop() prevented any retry
    expect(vi.mocked(global.fetch)).toHaveBeenCalledTimes(1)
    expect(connectionState.value).toBe('ended')
  })
})

// ===========================================================================
// stop()
// ===========================================================================
describe('stop()', () => {
  it('sets connectionState to ended immediately (even mid-connect)', () => {
    // fetch never resolves — simulates slow network
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}))
    const { connectionState, start, stop } = useDeploymentStream(ref('d-1'))
    start()
    expect(connectionState.value).toBe('connecting')
    stop()
    expect(connectionState.value).toBe('ended')
  })
})

// ===========================================================================
// start() reset
// ===========================================================================
describe('start() reset', () => {
  it('clears all previous state before the new connection attempt', async () => {
    mockOkFetch([
      sseFrame('progress', { phase: 'BUILD', phase_index: 3, total_phases: 8, progress_pct: 40, phase_names: ['A', 'B'] }),
    ])
    const { progress, totalPhases, phaseNames, liveLogs, start } = useDeploymentStream(ref('d-1'))
    start()
    await drain()
    expect(progress.value).toBe(40)
    expect(totalPhases.value).toBe(8)
    expect(phaseNames.value).toEqual(['A', 'B'])

    // Second start — fresh empty stream
    mockOkFetch([])
    start()
    // reset() runs synchronously inside start(), before connect() yields
    expect(progress.value).toBeNull()
    expect(totalPhases.value).toBe(11)  // back to default
    expect(phaseNames.value).toEqual([])
    expect(liveLogs.value).toEqual([])
  })
})
