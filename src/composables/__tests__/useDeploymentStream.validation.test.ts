import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDeploymentStream } from '../useDeploymentStream'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false

const mocks = vi.hoisted(() => ({ getAccessToken: vi.fn() }))
vi.mock('@/services/keycloak.service', () => ({ keycloak: { getAccessToken: mocks.getAccessToken } }))

function setup(id: string | null) {
  const { result } = renderHook(() => useDeploymentStream(id))
  return new Proxy({} as ReturnType<typeof useDeploymentStream>, {
    get: (_t, key) => (result.current as unknown as Record<string | symbol, unknown>)[key],
  })
}

function sseResponse(chunks: (string | Error)[]) {
  const encoder = new TextEncoder()
  let index = 0
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        async read() {
          if (index >= chunks.length) return { done: true, value: undefined }
          const chunk = chunks[index++]!
          if (chunk instanceof Error) throw chunk
          return { done: false, value: encoder.encode(chunk) }
        },
      }),
    },
  } as unknown as Response
}

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
const goodProgress = { phase: 'A', phase_index: 1, total_phases: 4, progress_pct: 25 }

async function flush(times = 5) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
  }
}

let warn: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  mocks.getAccessToken.mockResolvedValue('token')
  vi.stubGlobal('fetch', vi.fn())
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function run(chunks: (string | Error)[], id = 'd-1') {
  vi.mocked(fetch).mockResolvedValueOnce(sseResponse(chunks))
  const stream = setup(id)
  stream.start()
  await flush()
  return stream
}

describe('invalid SSE events', () => {
  it('counts nothing and warns about nothing for valid events', async () => {
    const stream = await run([
      frame('snapshot', { status: 'RUNNING', current_phase: 'A', progress_pct: 1 }),
      frame('progress', goodProgress),
      frame('log', { level: 'INFO', message: 'm', timestamp: 't' }),
      frame('overflow', {}),
    ])
    expect(stream.invalidEvents).toBe(0)
    expect(warn).not.toHaveBeenCalled()
  })

  it('drops a progress event with a missing progress_pct instead of writing undefined', async () => {
    const stream = await run([
      frame('progress', goodProgress),
      frame('progress', { phase: 'B', phase_index: 2, total_phases: 4 }),
    ])
    expect(stream.progress).toBe(25)
    expect(stream.currentPhase).toBe('A')
    expect(stream.currentPhaseIndex).toBe(1)
    expect(stream.invalidEvents).toBe(1)
  })

  it('drops a wrongly typed progress event completely (no partial update)', async () => {
    const stream = await run([
      frame('progress', goodProgress),
      frame('progress', { phase: 'B', phase_index: 2, total_phases: 9, progress_pct: '50', phase_names: ['X'] }),
    ])
    expect(stream.currentPhase).toBe('A')
    expect(stream.totalPhases).toBe(4)
    expect(stream.phaseNames).toEqual([])
  })

  it('drops an invalid snapshot without touching the state', async () => {
    const stream = await run([
      frame('progress', goodProgress),
      frame('snapshot', { status: 'RUNNING', current_phase: 99, progress_pct: 100 }),
    ])
    expect(stream.progress).toBe(25)
    expect(stream.currentPhase).toBe('A')
    expect(stream.invalidEvents).toBe(1)
  })

  it('drops invalid logs without touching the buffer or the counter', async () => {
    const stream = await run([
      frame('log', { level: 'INFO', message: 'ok', timestamp: 't' }),
      frame('log', { level: 'INFO' }),
      frame('log', { level: 'INFO', message: 'x', iso_timestamp: 12 }),
      'event: log\ndata: not json\n\n',
      frame('log', 'a string'),
      frame('log', null),
    ])
    expect(stream.liveLogs).toHaveLength(1)
    expect(stream.totalLogCount).toBe(1)
    expect(stream.invalidEvents).toBe(5)
  })

  it('warns once per event type and connection, counts every event, and leaks no payload', async () => {
    const stream = await run([
      frame('progress', { phase: 'SECRET-PHASE' }),
      frame('progress', { phase: 'SECRET-PHASE-2' }),
      frame('log', { message: 'SECRET-MESSAGE' }),
      frame('log', { message: 'SECRET-MESSAGE-2' }),
      frame('snapshot', { status: 'SECRET-STATUS', progress_pct: 'x' }),
    ])
    expect(stream.invalidEvents).toBe(5)
    expect(warn).toHaveBeenCalledTimes(3)
    const text = warn.mock.calls.map((c: unknown[]) => c.map(String).join(' ')).join('\n')
    expect(text).toContain('progress')
    expect(text).toContain('log')
    expect(text).toContain('snapshot')
    expect(text).not.toMatch(/SECRET/)
  })

  it('warns again after a reconnect (new connection)', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch)
      .mockResolvedValueOnce(sseResponse([frame('progress', {}), new Error('drop')]))
      .mockResolvedValueOnce(sseResponse([frame('progress', {})]))
    const stream = setup('d-1')
    stream.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(warn).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(stream.invalidEvents).toBe(2)
  })

  it('resets invalidEvents (and the warning) when a new stream is started', async () => {
    const stream = await run([frame('progress', {})])
    expect(stream.invalidEvents).toBe(1)

    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([]))
    stream.start()
    await flush()
    expect(stream.invalidEvents).toBe(0)

    vi.mocked(fetch).mockResolvedValueOnce(sseResponse([frame('progress', {})]))
    stream.start()
    await flush()
    expect(stream.invalidEvents).toBe(1)
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it.each(['succeeded', 'failed', 'revoked'])('a %s event with an invalid payload still ends the stream', async (name) => {
    const stream = await run([`event: ${name}\ndata: {"broken\n\n`])
    expect(stream.connectionState).toBe('ended')
    expect(stream.invalidEvents).toBe(0)
    expect(warn).not.toHaveBeenCalled()
  })

  it('does not count or warn about unknown event types', async () => {
    const stream = await run([frame('heartbeat', { ping: 1 }), frame('message', 'x')])
    expect(stream.invalidEvents).toBe(0)
    expect(warn).not.toHaveBeenCalled()
  })

  it('an invalid terminal snapshot followed by the server closing still ends the stream', async () => {
    const stream = await run([frame('snapshot', { status: 'SUCCESS', progress_pct: 'oops' })])
    expect(stream.connectionState).toBe('ended')
    expect(stream.invalidEvents).toBe(1)
  })

  it('keeps accepting valid events after invalid ones', async () => {
    const stream = await run([frame('progress', {}), frame('progress', goodProgress)])
    expect(stream.progress).toBe(25)
    expect(stream.invalidEvents).toBe(1)
  })
})
