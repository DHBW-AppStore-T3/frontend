import { expect } from 'vitest'

/**
 * Fails a test that sends a real HTTP request it never mocked.
 *
 * Under happy-dom axios picks its `xhr` adapter (happy-dom provides
 * XMLHttpRequest), so the guard covers both XMLHttpRequest and `fetch`.
 * Without it such a request goes to `env.API_URL` (http://localhost:8000),
 * is refused, and the test depends on timing and on whatever listens there.
 *
 * - Active in every test that has a `window`; `// @vitest-environment node`
 *   tests are not affected.
 * - A test that replaces `fetch` / `XMLHttpRequest` itself (vi.stubGlobal)
 *   keeps its replacement: only the originals are wrapped.
 * - `allowRealNetwork()` lifts the guard for the current test.
 * - Code under test often swallows a failed request, so the violation is also
 *   recorded and rethrown from `afterEach` (see tests/setup.ts).
 * - `NETWORK_GUARD=warn` only logs and records instead of throwing (use it to
 *   list every offender in a full run before fixing them).
 */

export class UnmockedNetworkError extends Error {
  constructor(
    readonly kind: 'fetch' | 'xhr',
    readonly method: string,
    readonly url: string,
    readonly test: string,
  ) {
    super(`Unmocked ${kind} request: ${method} ${url} (test: "${test}"). Mock the API module or call allowRealNetwork().`)
    this.name = 'UnmockedNetworkError'
  }
}

export interface Violation {
  kind: 'fetch' | 'xhr'
  method: string
  url: string
  test: string
}

interface Target {
  fetch?: typeof fetch
  XMLHttpRequest?: typeof XMLHttpRequest
}

interface Options {
  mode?: 'throw' | 'warn'
}

const currentTest = () => expect.getState().currentTestName ?? '<outside a test>'

export function createNetworkGuard(target: Target, { mode = 'throw' }: Options = {}) {
  let violations: Violation[] = []
  let allowed = false
  let installed = false
  let originalFetch: typeof fetch | undefined
  let guardedFetch: typeof fetch | undefined
  let originalOpen: XMLHttpRequest['open'] | undefined
  let originalSend: XMLHttpRequest['send'] | undefined
  let patchedProto: XMLHttpRequest | undefined
  const requests = new WeakMap<object, { method: string; url: string }>()

  const refuse = (kind: Violation['kind'], method: string, url: string) => {
    const error = new UnmockedNetworkError(kind, method, url, currentTest())
    violations.push({ kind, method, url, test: error.test })
    if (mode === 'warn') {
      console.warn(error.message)
      return undefined
    }
    return error
  }

  return {
    install() {
      if (installed) return
      allowed = false
      // Nothing to guard without a window (node-environment tests).
      if (!target.fetch && !target.XMLHttpRequest) return
      installed = true

      originalFetch = target.fetch
      if (originalFetch) {
        const real = originalFetch
        guardedFetch = ((input: RequestInfo | URL, init?: RequestInit) => {
          if (allowed) return real(input, init)
          const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
          const url = input instanceof Request ? input.url : String(input)
          const error = refuse('fetch', method.toUpperCase(), url)
          return error ? Promise.reject(error) : Promise.resolve(new Response(null, { status: 599 }))
        }) as typeof fetch
        target.fetch = guardedFetch
      }

      const proto = target.XMLHttpRequest?.prototype
      if (proto) {
        patchedProto = proto
        originalOpen = proto.open
        originalSend = proto.send
        const open = originalOpen
        const send = originalSend
        proto.open = function (this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
          requests.set(this, { method: method.toUpperCase(), url: String(url) })
          return (open as (...args: unknown[]) => void).call(this, method, url, ...rest)
        } as XMLHttpRequest['open']
        proto.send = function (this: XMLHttpRequest, ...args: unknown[]) {
          if (!allowed) {
            const req = requests.get(this) ?? { method: 'GET', url: '<unknown>' }
            const error = refuse('xhr', req.method, req.url)
            if (error) throw error
            return undefined
          }
          return (send as (...a: unknown[]) => void).apply(this, args)
        } as XMLHttpRequest['send']
      }
    },

    uninstall() {
      if (!installed) return
      installed = false
      // A test that replaced fetch itself keeps its own value.
      if (originalFetch && target.fetch === guardedFetch) target.fetch = originalFetch
      if (patchedProto && originalOpen && originalSend) {
        patchedProto.open = originalOpen as XMLHttpRequest['open']
        patchedProto.send = originalSend as XMLHttpRequest['send']
      }
      allowed = false
    },

    allowRealNetwork() {
      allowed = true
    },
    isAllowed: () => allowed,
    isInstalled: () => installed,

    /** Returns and clears what was refused since the last call. */
    takeViolations(): Violation[] {
      const taken = violations
      violations = []
      return taken
    },
  }
}

const hasWindow = typeof window !== 'undefined'

export const networkGuard = createNetworkGuard(
  hasWindow ? (globalThis as Target) : {},
  { mode: process.env.NETWORK_GUARD === 'warn' ? 'warn' : 'throw' },
)

/** For deliberate integration tests that talk to a real server. */
export const allowRealNetwork = () => networkGuard.allowRealNetwork()
