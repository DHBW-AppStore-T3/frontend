import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  ensureValidToken: vi.fn(),
  login: vi.fn(),
}))

vi.mock('@/services/keycloak.service', () => ({ keycloak: mocks }))

async function loadApi() {
  const mod = await import('@/api/axios')
  return mod.default as any
}

beforeEach(() => {
  vi.resetModules()
  mocks.getAccessToken.mockReset()
  mocks.ensureValidToken.mockReset()
  mocks.login.mockReset()
})

// A 401 that a silent refresh cures used to reject the request that hit it: the
// token was renewed, but the caller still saw the failure (issue 147).
describe('axios: repeat a request after a cured 401', () => {
  it('sends the request once more when the refresh worked, and returns that answer', async () => {
    mocks.ensureValidToken.mockResolvedValue(true)
    const api = await loadApi()
    const retry = vi.spyOn(api, 'request').mockResolvedValue({ data: 'second try' })
    const config = { url: '/deployments', headers: {} }
    const error = { config, response: { status: 401, data: {} } }

    await expect(api.interceptors.response.handlers[0].rejected(error)).resolves.toEqual({ data: 'second try' })

    expect(retry).toHaveBeenCalledWith(config)
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('repeats a request only once: a second 401 for the same request is rejected', async () => {
    mocks.ensureValidToken.mockResolvedValue(true)
    const api = await loadApi()
    const retry = vi.spyOn(api, 'request').mockResolvedValue({ data: 1 })
    const config = { url: '/x', headers: {} }
    const error = { config, response: { status: 401, data: {} } }

    await api.interceptors.response.handlers[0].rejected(error)
    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)

    expect(retry).toHaveBeenCalledTimes(1)
  })

  it('does not repeat when the session cannot be refreshed (login redirect as before)', async () => {
    mocks.ensureValidToken.mockResolvedValue(false)
    mocks.login.mockResolvedValue(undefined)
    const api = await loadApi()
    const retry = vi.spyOn(api, 'request')
    const error = { config: { url: '/x', headers: {} }, response: { status: 401, data: {} } }

    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)

    expect(retry).not.toHaveBeenCalled()
    expect(mocks.login).toHaveBeenCalled()
  })

  it('does not repeat other errors', async () => {
    const api = await loadApi()
    const retry = vi.spyOn(api, 'request')
    const error = { config: { url: '/x', headers: {} }, response: { status: 500, data: {} } }

    await expect(api.interceptors.response.handlers[0].rejected(error)).rejects.toBe(error)

    expect(retry).not.toHaveBeenCalled()
  })
})
