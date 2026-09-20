import { defineStore } from 'pinia'
import { courseApi } from '@/api/course.api'
import type { Course, CourseWithUsers, CourseCreate, CourseUpdate, User } from '@/types'
import { runRequest } from './_request'
import { extractErrorMessage } from '@/utils/http-error'

export const useCourseStore = defineStore('course', {
  state: () => ({
    courses: [] as Course[],
    currentCourse: null as CourseWithUsers | null,
    // Sole source of truth for the detail page's roster — kept
    // separate from ``currentCourse.users`` so member mutations don't
    // need to refetch the whole course just to update the list.
    currentMembers: [] as User[],
    isLoading: false,
    error: null as string | null,
  }),

  actions: {
    async fetchCourses() {
      await runRequest(this, async () => {
        const { data } = await courseApi.list()
        this.courses = data
      }, 'Failed to fetch courses', { rethrow: false })
    },

    async fetchCourseById(courseId: string) {
      await runRequest(this, async () => {
        const { data } = await courseApi.getById(courseId)
        this.currentCourse = data
        this.currentMembers = data.users ?? []
      }, 'Failed to fetch course')
    },

    async createCourse(data: CourseCreate) {
      return runRequest(this, async () => {
        const { data: course } = await courseApi.create(data)
        this.courses.push(course)
        return course
      }, 'Failed to create course')
    },

    async updateCourse(courseId: string, data: CourseUpdate) {
      return runRequest(this, async () => {
        const { data: course } = await courseApi.update(courseId, data)
        const index = this.courses.findIndex((c) => c.courseId === courseId)
        if (index !== -1) {
          this.courses[index] = course
        }
        if (this.currentCourse && this.currentCourse.courseId === courseId) {
          this.currentCourse = { ...this.currentCourse, ...course }
        }
        return course
      }, 'Failed to update course')
    },

    async deleteCourse(courseId: string) {
      await runRequest(this, async () => {
        await courseApi.delete(courseId)
        this.courses = this.courses.filter((c) => c.courseId !== courseId)
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
    async fetchMembers(courseId: string) {
      try {
        const { data } = await courseApi.listMembers(courseId)
        this.currentMembers = data
        return data
      } catch (err) {
        this.error = extractErrorMessage(err, 'Failed to fetch members')
        throw err
      }
    },

    async addMembers(courseId: string, userIds: string[]) {
      try {
        const { data } = await courseApi.addMembers(courseId, userIds)
        this.currentMembers = data
        return data
      } catch (err) {
        this.error = extractErrorMessage(err, 'Failed to add members')
        throw err
      }
    },

    async removeMember(courseId: string, userId: string) {
      try {
        await courseApi.removeMember(courseId, userId)
        this.currentMembers = this.currentMembers.filter((u) => u.userId !== userId)
      } catch (err) {
        this.error = extractErrorMessage(err, 'Failed to remove member')
        throw err
      }
    },
  },
})
