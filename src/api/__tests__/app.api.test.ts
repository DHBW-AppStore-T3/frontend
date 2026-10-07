import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('appApi', () => {
  it('list() hits GET /apps/ with query params', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.list({ userId: 'u-1' } as any)

    expect(api.get).toHaveBeenCalledWith('/apps/', { params: { userId: 'u-1' } })
  })

  it('getById() defaults refresh to false', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.getById('a-1')

    expect(api.get).toHaveBeenCalledWith('/apps/a-1', { params: { refresh: false } })
  })

  it('getById() forwards an explicit refresh flag', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.getById('a-1', true)

    expect(api.get).toHaveBeenCalledWith('/apps/a-1', { params: { refresh: true } })
  })

  it('create() posts to /apps/', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')
    const payload = { name: 'New' }

    appApi.create(payload as any)

    expect(api.post).toHaveBeenCalledWith('/apps/', payload)
  })

  it('update() puts to /apps/:id', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')
    const payload = { name: 'Renamed' }

    appApi.update('a-1', payload as any)

    expect(api.put).toHaveBeenCalledWith('/apps/a-1', payload)
  })

  it('delete() deletes /apps/:id', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.delete('a-1')

    expect(api.delete).toHaveBeenCalledWith('/apps/a-1')
  })

  it('getVariables() passes the version as a query param', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.getVariables('a-1', '1.2.3')

    expect(api.get).toHaveBeenCalledWith('/apps/a-1/variables', { params: { version: '1.2.3' } })
  })

  it('submitVersion() URL-encodes the version tag and sends diff/notes', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.submitVersion('a-1', 'v1/beta', 'https://diff.example', 'notes here')

    expect(api.post).toHaveBeenCalledWith(
      '/apps/a-1/versions/v1%2Fbeta/submit',
      { diff_url: 'https://diff.example', notes: 'notes here' },
    )
  })

  it('submitVersion() defaults diff_url/notes to null when omitted', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.submitVersion('a-1', 'v1.0')

    expect(api.post).toHaveBeenCalledWith(
      '/apps/a-1/versions/v1.0/submit',
      { diff_url: null, notes: null },
    )
  })

  it('withdrawVersion() deletes the submission', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.withdrawVersion('a-1', 'v1.0')

    expect(api.delete).toHaveBeenCalledWith('/apps/a-1/versions/v1.0/submit')
  })

  it('listVersionApprovals() lists submissions for an app', async () => {
    const api = (await import('@/api/axios')).default
    const { appApi } = await import('@/api/app.api')

    appApi.listVersionApprovals('a-1')

    expect(api.get).toHaveBeenCalledWith('/apps/a-1/versions')
  })

  describe('admin', () => {
    it('listPendingApprovals() hits the admin pending endpoint', async () => {
      const api = (await import('@/api/axios')).default
      const { appApi } = await import('@/api/app.api')

      appApi.admin.listPendingApprovals()

      expect(api.get).toHaveBeenCalledWith('/admin/apps/versions/pending')
    })

    it('approveVersion() posts to the approve endpoint', async () => {
      const api = (await import('@/api/axios')).default
      const { appApi } = await import('@/api/app.api')

      appApi.admin.approveVersion('a-1', 'v1.0')

      expect(api.post).toHaveBeenCalledWith('/admin/apps/a-1/versions/v1.0/approve')
    })

    it('rejectVersion() sends the rejection reason', async () => {
      const api = (await import('@/api/axios')).default
      const { appApi } = await import('@/api/app.api')

      appApi.admin.rejectVersion('a-1', 'v1.0', 'does not build')

      expect(api.post).toHaveBeenCalledWith(
        '/admin/apps/a-1/versions/v1.0/reject',
        { rejection_reason: 'does not build' },
      )
    })

    it('revokeVersion() sends the revocation reason', async () => {
      const api = (await import('@/api/axios')).default
      const { appApi } = await import('@/api/app.api')

      appApi.admin.revokeVersion('a-1', 'v1.0', 'security issue')

      expect(api.post).toHaveBeenCalledWith(
        '/admin/apps/a-1/versions/v1.0/revoke',
        { rejection_reason: 'security issue' },
      )
    })
  })
})
