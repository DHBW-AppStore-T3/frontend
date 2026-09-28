import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useCourseStore } from '@/stores/course.store'

// ---------------------------------------------------------------------------
// Mock courseApi
// ---------------------------------------------------------------------------
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

import { courseApi } from '@/api/course.api'
const mockCourseApi = courseApi as Record<string, ReturnType<typeof vi.fn>>

const COURSE_A = { courseId: 'c-1', name: 'Web Development', description: '' }
const COURSE_B = { courseId: 'c-2', name: 'Data Science', description: '' }
const COURSE_WITH_USERS = { ...COURSE_A, users: [{ userId: 'u-1', name: 'Alice' }] }

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('course.store — fetchCourses', () => {
  it('populates courses on success', async () => {
    mockCourseApi.list.mockResolvedValue({ data: [COURSE_A, COURSE_B] })
    const store = useCourseStore()
    await store.fetchCourses()
    expect(store.courses).toEqual([COURSE_A, COURSE_B])
    expect(store.isLoading).toBe(false)
    expect(store.error).toBeNull()
  })

  it('sets error but does not rethrow on failure', async () => {
    mockCourseApi.list.mockRejectedValue(new Error('network'))
    const store = useCourseStore()
    await expect(store.fetchCourses()).resolves.toBeUndefined()
    expect(store.error).toBeTruthy()
    expect(store.courses).toEqual([])
  })
})

describe('course.store — fetchCourseById', () => {
  it('sets currentCourse and currentMembers', async () => {
    mockCourseApi.getById.mockResolvedValue({ data: COURSE_WITH_USERS })
    const store = useCourseStore()
    await store.fetchCourseById('c-1')
    expect(store.currentCourse).toEqual(COURSE_WITH_USERS)
    expect(store.currentMembers).toEqual(COURSE_WITH_USERS.users)
  })

  it('handles missing users array', async () => {
    mockCourseApi.getById.mockResolvedValue({ data: COURSE_A })
    const store = useCourseStore()
    await store.fetchCourseById('c-1')
    expect(store.currentMembers).toEqual([])
  })
})

describe('course.store — createCourse', () => {
  it('appends new course to list', async () => {
    mockCourseApi.create.mockResolvedValue({ data: COURSE_A })
    const store = useCourseStore()
    const result = await store.createCourse({ name: 'Web Development' } as any)
    expect(result).toEqual(COURSE_A)
    expect(store.courses).toContainEqual(COURSE_A)
  })
})

describe('course.store — updateCourse', () => {
  it('replaces course in list by courseId', async () => {
    const updated = { ...COURSE_A, name: 'Web Dev Updated' }
    mockCourseApi.update.mockResolvedValue({ data: updated })
    const store = useCourseStore()
    store.courses = [COURSE_A, COURSE_B]
    await store.updateCourse('c-1', { name: 'Web Dev Updated' } as any)
    expect(store.courses[0]).toEqual(updated)
    expect(store.courses[1]).toEqual(COURSE_B)
  })

  it('merges into currentCourse when ids match', async () => {
    const updated = { ...COURSE_A, name: 'Web Dev Updated' }
    mockCourseApi.update.mockResolvedValue({ data: updated })
    const store = useCourseStore()
    store.currentCourse = COURSE_WITH_USERS as any
    await store.updateCourse('c-1', { name: 'Web Dev Updated' } as any)
    expect(store.currentCourse?.name).toBe('Web Dev Updated')
  })
})

describe('course.store — deleteCourse', () => {
  it('removes course from list', async () => {
    mockCourseApi.delete.mockResolvedValue({})
    const store = useCourseStore()
    store.courses = [COURSE_A, COURSE_B]
    await store.deleteCourse('c-1')
    expect(store.courses).toEqual([COURSE_B])
  })
})

describe('course.store — member actions', () => {
  it('fetchMembers populates currentMembers', async () => {
    const members = [{ userId: 'u-1' }, { userId: 'u-2' }]
    mockCourseApi.listMembers.mockResolvedValue({ data: members })
    const store = useCourseStore()
    const result = await store.fetchMembers('c-1')
    expect(store.currentMembers).toEqual(members)
    expect(result).toEqual(members)
  })

  it('fetchMembers sets error and rethrows on failure', async () => {
    mockCourseApi.listMembers.mockRejectedValue(new Error('500'))
    const store = useCourseStore()
    await expect(store.fetchMembers('c-1')).rejects.toThrow('500')
    expect(store.error).toBeTruthy()
  })

  it('addMembers replaces currentMembers with returned roster', async () => {
    const roster = [{ userId: 'u-1' }, { userId: 'u-3' }]
    mockCourseApi.addMembers.mockResolvedValue({ data: roster })
    const store = useCourseStore()
    await store.addMembers('c-1', ['u-3'])
    expect(store.currentMembers).toEqual(roster)
  })

  it('removeMember filters userId out of currentMembers', async () => {
    mockCourseApi.removeMember.mockResolvedValue({})
    const store = useCourseStore()
    store.currentMembers = [{ userId: 'u-1' } as any, { userId: 'u-2' } as any]
    await store.removeMember('c-1', 'u-1')
    expect(store.currentMembers).toEqual([{ userId: 'u-2' }])
  })

  it('removeMember sets error and rethrows on failure', async () => {
    mockCourseApi.removeMember.mockRejectedValue(new Error('403'))
    const store = useCourseStore()
    store.currentMembers = [{ userId: 'u-1' } as any]
    await expect(store.removeMember('c-1', 'u-1')).rejects.toThrow()
    expect(store.error).toBeTruthy()
  })
})
