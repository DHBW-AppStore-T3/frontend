import { describe, it, expect, vi } from 'vitest'

vi.mock('@/api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

describe('courseApi', () => {
  it('list() defaults skip/limit', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')

    courseApi.list()

    expect(api.get).toHaveBeenCalledWith('/courses/', { params: { skip: 0, limit: 100 } })
  })

  it('list() forwards explicit skip/limit', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')

    courseApi.list(20, 10)

    expect(api.get).toHaveBeenCalledWith('/courses/', { params: { skip: 20, limit: 10 } })
  })

  it('getById() fetches a course with its users', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')

    courseApi.getById('c-1')

    expect(api.get).toHaveBeenCalledWith('/courses/c-1')
  })

  it('create() posts the payload to /courses/', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')
    const payload = { name: 'Informatik' }

    courseApi.create(payload as any)

    expect(api.post).toHaveBeenCalledWith('/courses/', payload)
  })

  it('update() puts to /courses/:id', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')
    const payload = { name: 'Renamed' }

    courseApi.update('c-1', payload as any)

    expect(api.put).toHaveBeenCalledWith('/courses/c-1', payload)
  })

  it('delete() deletes /courses/:id', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')

    courseApi.delete('c-1')

    expect(api.delete).toHaveBeenCalledWith('/courses/c-1')
  })

  it('listMembers() fetches the course roster', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')

    courseApi.listMembers('c-1')

    expect(api.get).toHaveBeenCalledWith('/courses/c-1/users')
  })

  it('addMembers() posts the user ids to add', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')

    courseApi.addMembers('c-1', ['u-1', 'u-2'])

    expect(api.post).toHaveBeenCalledWith('/courses/c-1/users', { userIds: ['u-1', 'u-2'] })
  })

  it('removeMember() deletes the membership', async () => {
    const api = (await import('@/api/axios')).default
    const { courseApi } = await import('@/api/course.api')

    courseApi.removeMember('c-1', 'u-1')

    expect(api.delete).toHaveBeenCalledWith('/courses/c-1/users/u-1')
  })
})
