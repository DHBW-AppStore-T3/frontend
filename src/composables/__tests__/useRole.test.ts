import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { useRole } from '@/composables/useRole'
import type { App, Deployment, Course } from '@/types'

// useRole calls useAuthStore() which needs a real Pinia or a mock.
// We mock the store module so the composable gets a controlled user.

let mockUser: any = null

vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({
    get user() { return mockUser }
  })
}))

// Utility: mount a throw-away component that calls useRole() and returns
// the composable's return value. Needed because computed() requires an
// active Vue reactive context.
function setupRole(): ReturnType<typeof useRole> {
  let result: ReturnType<typeof useRole>
  mount({
    setup() {
      result = useRole()
      return {}
    },
    template: '<div />'
  })
  return result!
}

// Minimal fixture helpers
const makeApp = (partial: Partial<App> = {}): App =>
  ({ appId: 'a1', userId: 'user-1', name: 'App', ...partial } as App)

const makeDeployment = (partial: Partial<Deployment> = {}): Deployment =>
  ({ deploymentId: 'd1', userId: 'user-1', ...partial } as Deployment)

const makeCourse = (partial: Partial<Course & { teacherIds?: string[] }> = {}): Course & { teacherIds?: string[] } =>
  ({ courseId: 'c1', ...partial } as Course & { teacherIds?: string[] })

describe('useRole', () => {
  describe('role flags', () => {
    it('isAdmin is true for "admin" role', () => {
      mockUser = { userId: 'u1', role: 'admin' }
      const { isAdmin, isTeacher, isStudent, isStaff } = setupRole()
      expect(isAdmin.value).toBe(true)
      expect(isTeacher.value).toBe(false)
      expect(isStudent.value).toBe(false)
      expect(isStaff.value).toBe(true)
    })

    it('isTeacher and isStaff are true for "teacher" role', () => {
      mockUser = { userId: 'u1', role: 'teacher' }
      const { isAdmin, isTeacher, isStudent, isStaff } = setupRole()
      expect(isAdmin.value).toBe(false)
      expect(isTeacher.value).toBe(true)
      expect(isStudent.value).toBe(false)
      expect(isStaff.value).toBe(true)
    })

    it('isStudent is true and isStaff false for "student" role', () => {
      mockUser = { userId: 'u1', role: 'student' }
      const { isAdmin, isTeacher, isStudent, isStaff } = setupRole()
      expect(isAdmin.value).toBe(false)
      expect(isTeacher.value).toBe(false)
      expect(isStudent.value).toBe(true)
      expect(isStaff.value).toBe(false)
    })

    it('all role flags are false when user is null', () => {
      mockUser = null
      const { isAdmin, isTeacher, isStudent, isStaff } = setupRole()
      expect(isAdmin.value).toBe(false)
      expect(isTeacher.value).toBe(false)
      expect(isStudent.value).toBe(false)
      expect(isStaff.value).toBe(false)
    })
  })

  describe('canEditApp / canDeleteApp / canSubmitAppVersion', () => {
    it('returns true for admin regardless of ownership', () => {
      mockUser = { userId: 'admin-1', role: 'admin' }
      const { canEditApp, canDeleteApp, canSubmitAppVersion } = setupRole()
      const app = makeApp({ userId: 'someone-else' })
      expect(canEditApp(app)).toBe(true)
      expect(canDeleteApp(app)).toBe(true)
      expect(canSubmitAppVersion(app)).toBe(true)
    })

    it('returns true for the owner of the app', () => {
      mockUser = { userId: 'user-1', role: 'student' }
      const { canEditApp } = setupRole()
      const ownApp = makeApp({ userId: 'user-1' })
      expect(canEditApp(ownApp)).toBe(true)
    })

    it('returns false for a non-admin who does not own the app', () => {
      mockUser = { userId: 'user-1', role: 'student' }
      const { canEditApp } = setupRole()
      const othersApp = makeApp({ userId: 'user-2' })
      expect(canEditApp(othersApp)).toBe(false)
    })
  })

  describe('canApproveApp / canChangeUserRole', () => {
    it('canApproveApp is true for admin, false otherwise', () => {
      mockUser = { userId: 'u1', role: 'admin' }
      expect(setupRole().canApproveApp.value).toBe(true)
      mockUser = { userId: 'u1', role: 'teacher' }
      expect(setupRole().canApproveApp.value).toBe(false)
    })

    it('canChangeUserRole is true for admin, false otherwise', () => {
      mockUser = { userId: 'u1', role: 'admin' }
      expect(setupRole().canChangeUserRole.value).toBe(true)
      mockUser = { userId: 'u1', role: 'student' }
      expect(setupRole().canChangeUserRole.value).toBe(false)
    })
  })

  describe('canOperateDeployment', () => {
    it('returns true for admin regardless of ownership', () => {
      mockUser = { userId: 'admin-1', role: 'admin' }
      const { canOperateDeployment } = setupRole()
      expect(canOperateDeployment(makeDeployment({ userId: 'other' }))).toBe(true)
    })

    it('returns true for the owner of the deployment', () => {
      mockUser = { userId: 'user-1', role: 'student' }
      const { canOperateDeployment } = setupRole()
      expect(canOperateDeployment(makeDeployment({ userId: 'user-1' }))).toBe(true)
    })

    it('returns false for a non-admin who does not own the deployment', () => {
      mockUser = { userId: 'user-1', role: 'student' }
      const { canOperateDeployment } = setupRole()
      expect(canOperateDeployment(makeDeployment({ userId: 'user-2' }))).toBe(false)
    })
  })

  describe('canEditCourse', () => {
    it('returns true for admin regardless of teacherIds', () => {
      mockUser = { userId: 'admin-1', role: 'admin' }
      const { canEditCourse } = setupRole()
      expect(canEditCourse(makeCourse({ teacherIds: [] }))).toBe(true)
    })

    it('returns true when user is in the course teacherIds list', () => {
      mockUser = { userId: 'teacher-1', role: 'teacher' }
      const { canEditCourse } = setupRole()
      expect(canEditCourse(makeCourse({ teacherIds: ['teacher-1', 'teacher-2'] }))).toBe(true)
    })

    it('returns false when user is not in teacherIds', () => {
      mockUser = { userId: 'teacher-3', role: 'teacher' }
      const { canEditCourse } = setupRole()
      expect(canEditCourse(makeCourse({ teacherIds: ['teacher-1'] }))).toBe(false)
    })

    it('returns false when teacherIds is absent', () => {
      mockUser = { userId: 'teacher-1', role: 'teacher' }
      const { canEditCourse } = setupRole()
      expect(canEditCourse(makeCourse({}))).toBe(false)
    })
  })
})
