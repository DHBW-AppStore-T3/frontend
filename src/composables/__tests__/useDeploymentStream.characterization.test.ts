import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDeploymentStream } from '../useDeploymentStream'

// Pins the behaviour for *valid* SSE events before the runtime validation of #90.
// Everything here must keep passing unchanged after the guards are in.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
}))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getAccessToken: mocks.getAccessToken },
}))

function setup(id: string | null) {
  const { result } = renderHook(() => useDeploymentStream(id))
  return new Proxy({} as ReturnType<typeof useDeploymentStream>, {
    get: (_t, key) => (result.current as unknown as Record<string | symbol, unknown>)[key],
  })
}

/** Streams the given chunks; an `Error` entry makes `read()` reject at that point. */
function sseResponse(chunks: (string | Error)[]) {
  const encoder = new TextEncoder()
  let index = 0
  const body = {
    getReader() {
      return {
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined }
          const chunk = chunks[index]!
          index += 1
          if (chunk instanceof Error) throw chunk
          return { done: false, value: encoder.encode(chunk) }
        },
      }
    },
  }
  return { ok: true, status: 200, body } as unknown as Response
}

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
const rawFrame = (event: string, data: string) => `event: ${event}\ndata: ${data}\n\n`

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
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('snapshot events', () => {
  it.each(['PENDING', 'RUNNING', 'running', 'pending'])(
    'adopts progress and phase from an active snapshot (%s)',
    async (status) => {
      vi.mocked(fetch).mockResolvedValueOnce(
        sseResponse([frame('snapshot', { task_id: 't', status, current_phase: 'PACKER_BUILD', progress_pct: 18, type: 'deploy' })]),
      )
      const stream = setup('d-1')
      stream.start()
      await flush()

      expect(stream.progress).toBe(18)
      expect(stream.currentPhase).toBe('PACKER_BUILD')
      // an active snapshot does not end the stream; only the server closing it does
      expect(stream.connectionState).toBe('ended')
    },
  )

  it('keeps the stream live after an active snapshot while the server keeps the connection open', async () => {
    const pending = new Promise<never>(() => {})
    const encoder = new TextEncoder()
    let sent = false
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: {
        getReader: () => ({
          async read() {
            if (!sent) {
              sent = true
              return { done: false, value: encoder.encode(frame('snapshot', { status: 'RUNNING', current_phase: 'A', progress_pct: 5 })) }
            }
            return pending
          },
        }),
      },
    } as unknown as Response)
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.connectionState).toBe('live')
    expect(stream.progress).toBe(5)
  })

  it('leaves progress and phase untouched when an active snapshot carries nulls', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        frame('progress', { phase: 'A', phase_index: 1, total_phases: 4, progress_pct: 30 }),
        frame('snapshot', { task_id: 't', status: 'RUNNING', current_phase: null, progress_pct: null, type: 'deploy' }),
      ]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.progress).toBe(30)
    expect(stream.currentPhase).toBe('A')
  })

  it.each(['SUCCESS', 'FAILED', 'CANCELLED', 'success'])(
    'ignores progress/phase of a terminal snapshot (%s) and ends the stream',
    async (status) => {
      vi.mocked(fetch).mockResolvedValueOnce(
        sseResponse([frame('snapshot', { task_id: 't', status, current_phase: 'OUTPUTS_READY', progress_pct: 100, type: 'deploy' })]),
      )
      const stream = setup('d-1')
      stream.start()
      await flush()

      expect(stream.progress).toBeNull()
      expect(stream.currentPhase).toBeNull()
      expect(stream.connectionState).toBe('ended')
    },
  )

  it('does not let a stale terminal snapshot overwrite a fresher progress value', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        frame('snapshot', { status: 'SUCCESS', current_phase: 'OUTPUTS_READY', progress_pct: 100, type: 'deploy' }),
        frame('progress', { phase: 'DESTROY_INIT', phase_index: 1, total_phases: 7, progress_pct: 14 }),
      ]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.progress).toBe(14)
    expect(stream.currentPhase).toBe('DESTROY_INIT')
    expect(stream.totalPhases).toBe(7)
  })

  it('handles a snapshot for a deployment without any task (all null)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('snapshot', { task_id: null, status: null, current_phase: null, progress_pct: null, type: null })]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.progress).toBeNull()
    expect(stream.currentPhase).toBeNull()
    expect(stream.connectionState).toBe('ended') // server closed the stream
  })
})

describe('progress events', () => {
  it('applies a progress event without phase_names and keeps phaseNames empty', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('progress', { phase: 'TERRAFORM_APPLY', phase_index: 3, total_phases: 11, progress_pct: 27 })]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.progress).toBe(27)
    expect(stream.currentPhase).toBe('TERRAFORM_APPLY')
    expect(stream.currentPhaseIndex).toBe(3)
    expect(stream.totalPhases).toBe(11)
    expect(stream.phaseNames).toEqual([])
  })

  it('ignores an empty phase_names list', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        frame('progress', { phase: 'A', phase_index: 1, total_phases: 2, progress_pct: 10, phase_names: ['A', 'B'] }),
        frame('progress', { phase: 'B', phase_index: 2, total_phases: 2, progress_pct: 90, phase_names: [] }),
      ]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.phaseNames).toEqual(['A', 'B'])
    expect(stream.progress).toBe(90)
  })

  it('accepts progress_pct 0 and phase_index 0', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('progress', { phase: 'INIT', phase_index: 0, total_phases: 5, progress_pct: 0 })]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.progress).toBe(0)
    expect(stream.currentPhaseIndex).toBe(0)
  })

  it('tolerates additional fields on a progress event (message, iso_timestamp, ...)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        frame('progress', {
          phase: 'A', phase_index: 1, total_phases: 2, progress_pct: 50,
          message: 'working', iso_timestamp: '2026-01-01T00:00:00Z', deployment_id: 'x',
        }),
      ]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.progress).toBe(50)
  })
})

describe('log events', () => {
  it('prefers iso_timestamp over timestamp and keeps the other fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        frame('log', {
          iso_timestamp: '2026-01-01T00:00:01Z', timestamp: '2026-01-01T00:00:02Z',
          level: 'ERROR', category: 'terraform', message: 'boom', tool: 'terraform', streaming: true,
        }),
      ]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.liveLogs).toEqual([
      {
        iso_timestamp: '2026-01-01T00:00:01Z', timestamp: '2026-01-01T00:00:01Z',
        level: 'ERROR', category: 'terraform', message: 'boom', tool: 'terraform', streaming: true,
      },
    ])
  })

  it('uses the plain timestamp when there is no iso_timestamp', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('log', { timestamp: '2026-02-02T10:00:00Z', level: 'INFO', message: 'm' })]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.liveLogs[0]!.timestamp).toBe('2026-02-02T10:00:00Z')
  })

  it('falls back to the current time when the log carries no timestamp', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([frame('log', { level: 'INFO', message: 'm' })]))
    const stream = setup('d-1')
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-03-03T03:03:03.000Z'))
    stream.start()
    await flush()

    expect(stream.liveLogs[0]!.timestamp).toBe('2026-03-03T03:03:03.000Z')
  })

  it('passes optional fields through unchanged (extra worker fields included)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([frame('log', { timestamp: 't', level: 'INFO', message: 'm', phase: 'P', progress_pct: 12, returncode: 0 })]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.liveLogs[0]).toMatchObject({ phase: 'P', progress_pct: 12, returncode: 0 })
  })
})

describe('overflow and terminal events', () => {
  it('turns an overflow event into the exact system warning entry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([frame('overflow', {})]))
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.liveLogs).toHaveLength(1)
    expect(stream.liveLogs[0]).toMatchObject({
      level: 'WARNING',
      category: 'system',
      message: 'Live stream lagged behind — older entries dropped',
    })
    expect(stream.totalLogCount).toBe(1)
  })

  it.each(['succeeded', 'failed', 'revoked'])(
    '%s ends the stream whatever the payload looks like',
    async (eventName) => {
      for (const payload of ['{}', 'null', '"text"', '[1,2]', 'not json at all', '{"task_id": 5}']) {
        vi.mocked(fetch).mockResolvedValueOnce(sseResponse([rawFrame(eventName, payload)]))
        const stream = setup('d-1')
        stream.start()
        await flush()
        expect(stream.connectionState).toBe('ended')
      }
    },
  )

  it('ignores frames without data, comment frames and keepalives', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([': keepalive\n\n', 'event: log\n\n', frame('log', { timestamp: 't', level: 'INFO', message: 'only' })]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.liveLogs).toHaveLength(1)
  })

  it('assembles frames that arrive split across chunks', async () => {
    const whole = frame('progress', { phase: 'A', phase_index: 1, total_phases: 2, progress_pct: 50 })
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([whole.slice(0, 20), whole.slice(20)]))
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.progress).toBe(50)
  })
})

describe('reconnect, stop and reset', () => {
  it('reconnects with doubling backoff after the body fails and goes live again', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch)
      .mockResolvedValueOnce(sseResponse([new Error('drop')]))
      .mockResolvedValueOnce(sseResponse([new Error('drop again')]))
      .mockResolvedValueOnce(sseResponse([frame('progress', { phase: 'A', phase_index: 1, total_phases: 2, progress_pct: 10 })]))
    const stream = setup('d-1')
    stream.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(stream.connectionState).toBe('reconnecting')
    expect(fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(999)
    expect(fetch).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(2)

    // second failure: the connection was ok in between, so the backoff restarts at 1s
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(stream.progress).toBe(10)
    expect(stream.connectionState).toBe('ended')
  })

  it('doubles the backoff while the server keeps answering 5xx', async () => {
    vi.useFakeTimers()
    const fail = () => ({ ok: false, status: 503, body: null }) as unknown as Response
    vi.mocked(fetch).mockResolvedValueOnce(fail()).mockResolvedValueOnce(fail()).mockResolvedValueOnce(sseResponse([]))
    const stream = setup('d-1')
    stream.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1999)
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('does not reconnect after stop()', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([new Error('drop')]))
    const stream = setup('d-1')
    stream.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(stream.connectionState).toBe('reconnecting')

    act(() => stream.stop())
    await vi.advanceTimersByTimeAsync(60_000)

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(stream.connectionState).toBe('ended')
  })

  it('start() resets progress, phases, logs and counters but connects again', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      sseResponse([
        frame('progress', { phase: 'A', phase_index: 1, total_phases: 3, progress_pct: 40, phase_names: ['A', 'B', 'C'] }),
        frame('log', { timestamp: 't', level: 'INFO', message: 'm' }),
      ]),
    )
    const stream = setup('d-1')
    stream.start()
    await flush()
    expect(stream.totalLogCount).toBe(1)
    expect(stream.phaseNames).toEqual(['A', 'B', 'C'])

    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([]))
    stream.start()
    await flush()

    expect(stream.phaseNames).toEqual([])
    expect(stream.currentPhaseIndex).toBeNull()
    expect(stream.liveLogs).toEqual([])
    expect(stream.totalLogCount).toBe(0)
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reports ended when the server closes the stream cleanly', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([frame('log', { timestamp: 't', level: 'INFO', message: 'm' })]))
    const stream = setup('d-1')
    stream.start()
    await flush()

    expect(stream.connectionState).toBe('ended')
    expect(stream.liveLogs).toHaveLength(1)
  })
})
