import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  ensureValidToken: vi.fn(),
  login: vi.fn(),
}))

vi.mock('@/composables/useKeycloak', () => ({
  useKeycloak: () => ({
    getAccessToken: mocks.getAccessToken,
    ensureValidToken: mocks.ensureValidToken,
    login: mocks.login,
  }),
}))

// `api` is a module-level singleton built once at import time; grabbing its
// interceptor handlers lets the request/response pipeline be exercised
// without a real network call.
async function loadApi() {
  const mod = await import('@/api/axios')
  return mod.default as any
}

beforeEach(() => {
  vi.resetModules()
  mocks.getAccessToken.mockReset()
  mocks.ensureValidToken.mockReset()
  mocks.login.mockReset()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, pathname: '/dashboard' },
    writable: true,
  })
})

describe('axios request interceptor', () => {
  it('attaches the bearer token when one is available', async () => {
    mocks.getAccessToken.mockResolvedValue('token-123')
    const api = await loadApi()

    const config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} })

    expect(config.headers.Authorization).toBe('Bearer token-123')
  })

  it('leaves the Authorization header unset when there is no token', async () => {
    mocks.getAccessToken.mockResolvedValue(null)
    const api = await loadApi()

    const config = await api.interceptors.request.handlers[0].fulfilled({ headers: {} })

    expect(config.headers.Authorization).toBeUndefined()
  })

  it('rejects the request when the token lookup itself throws', async () => {
    const api = await loadApi()
    const err = new Error('keycloak down')

    await expect(api.interceptors.request.handlers[0].rejected(err)).rejects.toBe(err)
  })
})

describe('axios response interceptor', () => {
  it('passes successful responses through unchanged', async () => {
    const api = await loadApi()
    const response = { status: 200, data: { ok: true } }

    expect(api.interceptors.response.handlers[0].fulfilled(response)).toBe(response)
  })

  it('on 401 with a refreshable session, does not redirect', async () => {
    mocks.ensureValidToken.mockResolvedValue(true)
    const api = await loadApi()
    const error = { response: { status: 401, data: {} } }

    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('on 401 with no refreshable session, redirects to login with the current path', async () => {
    mocks.ensureValidToken.mockResolvedValue(false)
    mocks.login.mockResolvedValue(undefined)
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/deployments/42' },
      writable: true,
    })
    const api = await loadApi()
    const error = { response: { status: 401, data: {} } }

    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)
    expect(mocks.login).toHaveBeenCalledWith('/deployments/42')
  })

  it('on 401 while already on /login, does not trigger another redirect', async () => {
    mocks.ensureValidToken.mockResolvedValue(false)
    Object.defineProperty(window, 'location', {
      value: { ...window.location, pathname: '/login' },
      writable: true,
    })
    const api = await loadApi()
    const error = { response: { status: 401, data: {} } }

    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('on 403, logs the error without redirecting', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const api = await loadApi()
    const error = { response: { status: 403, data: { detail: 'forbidden' } } }

    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)
    expect(consoleError).toHaveBeenCalledWith('Access forbidden:', { detail: 'forbidden' })
    expect(mocks.login).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('passes through other status codes untouched', async () => {
    const api = await loadApi()
    const error = { response: { status: 500, data: {} } }

    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)
    expect(mocks.login).not.toHaveBeenCalled()
    expect(mocks.ensureValidToken).not.toHaveBeenCalled()
  })

  it('passes through network errors with no response object', async () => {
    const api = await loadApi()
    const error = { message: 'Network Error' }

    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)
  })
})
