import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCourseStore } from '../course.store'

vi.mock('@/api/course.api', () => ({
  courseApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listMembers: vi.fn(),
    addMembers: vi.fn(),
    removeMember: vi.fn(),
  },
}))

describe('CourseStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with empty state', () => {
    const store = useCourseStore()
    expect(store.courses).toEqual([])
    expect(store.currentCourse).toBeNull()
    expect(store.currentMembers).toEqual([])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  describe('fetchCourses', () => {
    it('sets courses from the API', async () => {
      const { courseApi } = await import('@/api/course.api')
      const courses = [{ courseId: 'c-1', name: 'Informatik' }]
      vi.mocked(courseApi.list).mockResolvedValueOnce({ data: courses } as any)

      const store = useCourseStore()
      await store.fetchCourses()

      expect(store.courses).toEqual(courses)
      expect(store.error).toBeNull()
    })

    it('swallows errors', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.list).mockRejectedValueOnce(new Error('down'))

      const store = useCourseStore()
      await expect(store.fetchCourses()).resolves.toBeUndefined()
      expect(store.error).toBe('down')
    })
  })

  describe('fetchCourseById', () => {
    it('sets currentCourse and derives currentMembers from its users', async () => {
      const { courseApi } = await import('@/api/course.api')
      const course = { courseId: 'c-1', name: 'Informatik', users: [{ userId: 'u-1' }] }
      vi.mocked(courseApi.getById).mockResolvedValueOnce({ data: course } as any)

      const store = useCourseStore()
      await store.fetchCourseById('c-1')

      expect(store.currentCourse).toEqual(course)
      expect(store.currentMembers).toEqual([{ userId: 'u-1' }])
    })

    it('defaults currentMembers to an empty array when users is missing', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.getById).mockResolvedValueOnce({ data: { courseId: 'c-1' } } as any)

      const store = useCourseStore()
      await store.fetchCourseById('c-1')

      expect(store.currentMembers).toEqual([])
    })

    it('re-throws on failure', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.getById).mockRejectedValueOnce(new Error('not found'))

      const store = useCourseStore()
      await expect(store.fetchCourseById('c-1')).rejects.toThrow('not found')
    })
  })

  describe('createCourse', () => {
    it('appends the created course and returns it', async () => {
      const { courseApi } = await import('@/api/course.api')
      const course = { courseId: 'c-2', name: 'Mathematik' }
      vi.mocked(courseApi.create).mockResolvedValueOnce({ data: course } as any)

      const store = useCourseStore()
      const result = await store.createCourse({ name: 'Mathematik' } as any)

      expect(result).toEqual(course)
      expect(store.courses).toContainEqual(course)
    })
  })

  describe('updateCourse', () => {
    it('replaces the course in the list and merges into currentCourse', async () => {
      const { courseApi } = await import('@/api/course.api')
      const updated = { courseId: 'c-1', name: 'Renamed' }
      vi.mocked(courseApi.update).mockResolvedValueOnce({ data: updated } as any)

      const store = useCourseStore()
      store.courses = [{ courseId: 'c-1', name: 'Old' }] as any
      store.currentCourse = { courseId: 'c-1', name: 'Old', users: [] } as any

      await store.updateCourse('c-1', { name: 'Renamed' } as any)

      expect(store.courses[0]).toEqual(updated)
      expect(store.currentCourse).toEqual({ courseId: 'c-1', name: 'Renamed', users: [] })
    })

    it('does not touch currentCourse when updating a different course', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.update).mockResolvedValueOnce({ data: { courseId: 'c-2', name: 'Other' } } as any)

      const store = useCourseStore()
      store.courses = [{ courseId: 'c-2', name: 'Old' }] as any
      store.currentCourse = { courseId: 'c-1', name: 'Untouched' } as any

      await store.updateCourse('c-2', { name: 'Other' } as any)

      expect(store.currentCourse).toEqual({ courseId: 'c-1', name: 'Untouched' })
    })
  })

  describe('deleteCourse', () => {
    it('removes the course from the list', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.delete).mockResolvedValueOnce({} as any)

      const store = useCourseStore()
      store.courses = [{ courseId: 'c-1' }, { courseId: 'c-2' }] as any

      await store.deleteCourse('c-1')

      expect(store.courses).toEqual([{ courseId: 'c-2' }])
    })
  })

  describe('members', () => {
    it('fetchMembers sets currentMembers and does not touch isLoading', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.listMembers).mockResolvedValueOnce({ data: [{ userId: 'u-1' }] } as any)

      const store = useCourseStore()
      const result = await store.fetchMembers('c-1')

      expect(result).toEqual([{ userId: 'u-1' }])
      expect(store.currentMembers).toEqual([{ userId: 'u-1' }])
      expect(store.isLoading).toBe(false)
    })

    it('fetchMembers records the error and re-throws on failure', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.listMembers).mockRejectedValueOnce(new Error('forbidden'))

      const store = useCourseStore()
      await expect(store.fetchMembers('c-1')).rejects.toThrow('forbidden')
      expect(store.error).toBe('forbidden')
    })

    it('addMembers appends to the roster and returns the updated list', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.addMembers).mockResolvedValueOnce({ data: [{ userId: 'u-1' }, { userId: 'u-2' }] } as any)

      const store = useCourseStore()
      const result = await store.addMembers('c-1', ['u-2'])

      expect(result).toEqual([{ userId: 'u-1' }, { userId: 'u-2' }])
      expect(store.currentMembers).toEqual([{ userId: 'u-1' }, { userId: 'u-2' }])
    })

    it('addMembers records the error and re-throws on failure', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.addMembers).mockRejectedValueOnce(new Error('duplicate'))

      const store = useCourseStore()
      await expect(store.addMembers('c-1', ['u-2'])).rejects.toThrow('duplicate')
      expect(store.error).toBe('duplicate')
    })

    it('removeMember drops the user from currentMembers', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.removeMember).mockResolvedValueOnce({} as any)

      const store = useCourseStore()
      store.currentMembers = [{ userId: 'u-1' }, { userId: 'u-2' }] as any

      await store.removeMember('c-1', 'u-1')

      expect(store.currentMembers).toEqual([{ userId: 'u-2' }])
    })

    it('removeMember records the error and re-throws on failure', async () => {
      const { courseApi } = await import('@/api/course.api')
      vi.mocked(courseApi.removeMember).mockRejectedValueOnce(new Error('not a member'))

      const store = useCourseStore()
      await expect(store.removeMember('c-1', 'u-1')).rejects.toThrow('not a member')
      expect(store.error).toBe('not a member')
    })
  })
})
