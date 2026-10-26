import { describe, it, expect, vi } from 'vitest'
import {
  UnmockedNetworkError,
  allowRealNetwork,
  createNetworkGuard,
  networkGuard,
} from '../../helpers/network-guard'

// Real network is never touched here: the guard is pointed at fakes, or the
// request is refused before it leaves the process.

function fakeTarget() {
  const realFetch = vi.fn(async () => new Response('ok'))
  class FakeXhr {
    static opened: string[] = []
    open(_method: string, url: string) {
      FakeXhr.opened.push(url)
    }
    send() {}
  }
  const target = { fetch: realFetch as unknown as typeof fetch, XMLHttpRequest: FakeXhr as unknown as typeof XMLHttpRequest }
  return { target, realFetch, FakeXhr }
}

describe('network guard (isolated instance)', () => {
  it('rejects an unmocked fetch with method, URL and test name', async () => {
    const { target, realFetch } = fakeTarget()
    const guard = createNetworkGuard(target)
    guard.install()

    const err = await target.fetch('http://localhost:8000/apps', { method: 'POST' }).catch((e: unknown) => e)

    expect(err).toBeInstanceOf(UnmockedNetworkError)
    expect((err as Error).message).toContain('POST')
    expect((err as Error).message).toContain('http://localhost:8000/apps')
    expect((err as Error).message).toContain('rejects an unmocked fetch with method, URL and test name')
    expect(realFetch).not.toHaveBeenCalled()
    expect(guard.takeViolations()).toHaveLength(1)
    guard.uninstall()
  })

  it('throws on an unmocked XMLHttpRequest send (the adapter axios uses under happy-dom)', () => {
    const { target } = fakeTarget()
    const guard = createNetworkGuard(target)
    guard.install()

    const xhr = new target.XMLHttpRequest()
    xhr.open('GET', 'http://localhost:8000/health')

    expect(() => xhr.send()).toThrow(UnmockedNetworkError)
    expect(() => xhr.send()).toThrow(/GET http:\/\/localhost:8000\/health/)
    expect(guard.takeViolations()).toHaveLength(2)
    guard.uninstall()
  })

  it('lets requests through after allowRealNetwork()', async () => {
    const { target, realFetch } = fakeTarget()
    const guard = createNetworkGuard(target)
    guard.install()
    guard.allowRealNetwork()

    const res = await target.fetch('http://localhost:8000/ok')

    expect(await res.text()).toBe('ok')
    expect(realFetch).toHaveBeenCalledTimes(1)
    expect(guard.takeViolations()).toEqual([])
    guard.uninstall()
  })

  it('does not touch a fetch the test replaced itself', async () => {
    const { target } = fakeTarget()
    const guard = createNetworkGuard(target)
    guard.install()
    const mine = vi.fn(async () => new Response('mine'))
    target.fetch = mine as unknown as typeof fetch

    await target.fetch('http://localhost:8000/x')
    guard.uninstall()

    expect(mine).toHaveBeenCalledTimes(1)
    expect(target.fetch).toBe(mine)
    expect(guard.takeViolations()).toEqual([])
  })

  it('restores the originals on uninstall', () => {
    const { target, realFetch } = fakeTarget()
    const guard = createNetworkGuard(target)
    guard.install()
    expect(target.fetch).not.toBe(realFetch)
    guard.uninstall()
    expect(target.fetch).toBe(realFetch)
  })

  it('only warns instead of throwing in warn mode, but still records', async () => {
    const { target, realFetch } = fakeTarget()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const guard = createNetworkGuard(target, { mode: 'warn' })
    guard.install()

    await target.fetch('http://localhost:8000/warn')

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('http://localhost:8000/warn'))
    expect(realFetch).not.toHaveBeenCalled()
    expect(guard.takeViolations()).toHaveLength(1)
    guard.uninstall()
    warn.mockRestore()
  })
})

describe('network guard (installed by tests/setup.ts)', () => {
  it('blocks a real fetch and an axios call in this environment', async () => {
    const axios = (await import('axios')).default

    await expect(fetch('http://localhost:1/fetch')).rejects.toBeInstanceOf(UnmockedNetworkError)
    await expect(axios.get('http://localhost:1/axios')).rejects.toBeInstanceOf(UnmockedNetworkError)

    const violations = networkGuard.takeViolations()
    expect(violations.map((v) => v.kind)).toEqual(['fetch', 'xhr'])
  })

  it('ignores a fetch mocked with vi.stubGlobal', async () => {
    const mine = vi.fn(async () => new Response('stub'))
    vi.stubGlobal('fetch', mine)
    try {
      await fetch('http://localhost:1/stubbed')
      expect(mine).toHaveBeenCalledTimes(1)
      expect(networkGuard.takeViolations()).toEqual([])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('allowRealNetwork() disables the guard for this test only', async () => {
    allowRealNetwork()
    expect(networkGuard.isAllowed()).toBe(true)
  })

  it('has the guard active again in the next test', () => {
    expect(networkGuard.isAllowed()).toBe(false)
  })
})
