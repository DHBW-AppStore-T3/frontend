import { create } from 'zustand'
import { courseApi } from '@/api/course.api'
import type { Course, CourseWithUsers, CourseCreate, CourseUpdate, User } from '@/types'
import { runRequest } from './_request'
import { extractErrorMessage } from '@/utils/http-error'

interface CourseState {
  courses: Course[]
  currentCourse: CourseWithUsers | null
  // Sole source of truth for the detail page's roster — kept
  // separate from ``currentCourse.users`` so member mutations don't
  // need to refetch the whole course just to update the list.
  currentMembers: User[]
  isLoading: boolean
  error: string | null

  fetchCourses: () => Promise<void>
  fetchCourseById: (courseId: string) => Promise<void>
  createCourse: (data: CourseCreate) => Promise<Course>
  updateCourse: (courseId: string, data: CourseUpdate) => Promise<Course>
  deleteCourse: (courseId: string) => Promise<void>
  fetchMembers: (courseId: string) => Promise<User[]>
  addMembers: (courseId: string, userIds: string[]) => Promise<User[]>
  removeMember: (courseId: string, userId: string) => Promise<void>
}

export const useCourseStore = create<CourseState>()((set, get) => ({
  courses: [],
  currentCourse: null,
  currentMembers: [],
  isLoading: false,
  error: null,

  async fetchCourses() {
    await runRequest(set, async () => {
      const { data } = await courseApi.list()
      set({ courses: data })
    }, 'Failed to fetch courses', { rethrow: false })
  },

  async fetchCourseById(courseId) {
    await runRequest(set, async () => {
      const { data } = await courseApi.getById(courseId)
      set({ currentCourse: data, currentMembers: data.users ?? [] })
    }, 'Failed to fetch course')
  },

  async createCourse(data) {
    return runRequest(set, async () => {
      const { data: course } = await courseApi.create(data)
      set((s) => ({ courses: [...s.courses, course] }))
      return course
    }, 'Failed to create course')
  },

  async updateCourse(courseId, data) {
    return runRequest(set, async () => {
      const { data: course } = await courseApi.update(courseId, data)
      set((s) => ({
        courses: s.courses.map((c) => (c.courseId === courseId ? course : c)),
        currentCourse:
          s.currentCourse && s.currentCourse.courseId === courseId
            ? { ...s.currentCourse, ...course }
            : s.currentCourse,
      }))
      return course
    }, 'Failed to update course')
  },

  async deleteCourse(courseId) {
    await runRequest(set, async () => {
      await courseApi.delete(courseId)
      set((s) => ({ courses: s.courses.filter((c) => c.courseId !== courseId) }))
    }, 'Failed to delete course')
  },

  // --------------------------------------------------------------
  // MEMBERS
  // --------------------------------------------------------------
  // These three set `error` but deliberately never touch `isLoading`:
  // the member list renders inside an already-loaded course page and
  // must not put the whole view back into its loading state. That is
  // why they do not go through `runRequest` -- only the duplicated
  // error extraction is shared.
  async fetchMembers(courseId) {
    try {
      const { data } = await courseApi.listMembers(courseId)
      set({ currentMembers: data })
      return data
    } catch (err) {
      set({ error: extractErrorMessage(err, 'Failed to fetch members') })
      throw err
    }
  },

  async addMembers(courseId, userIds) {
    try {
      const { data } = await courseApi.addMembers(courseId, userIds)
      set({ currentMembers: data })
      return data
    } catch (err) {
      set({ error: extractErrorMessage(err, 'Failed to add members') })
      throw err
    }
  },

  async removeMember(courseId, userId) {
    try {
      await courseApi.removeMember(courseId, userId)
      set({ currentMembers: get().currentMembers.filter((u) => u.userId !== userId) })
    } catch (err) {
      set({ error: extractErrorMessage(err, 'Failed to remove member') })
      throw err
    }
  },
}))
