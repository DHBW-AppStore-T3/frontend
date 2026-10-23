import { useMemo } from 'react'
import { useAuthStore } from '@/stores/auth.store'
import type { App, Deployment, Course, UserRole as Role } from '@/types'

/**
 * Single source of truth for role + capability reads in the UI.
 *
 * Phase 4 of the RBAC plan replaces the old ``usePermissions`` and the
 * ``authStore.isAdmin`` / ``authStore.isTeacherOrAdmin`` direct reads
 * with this hook. The ``can*`` helpers mirror the backend
 * capabilities in ``backend/app/utils/capabilities.py`` — they are
 * purely cosmetic (controlling button visibility, route guards), the
 * authoritative check still happens in the API layer.
 */
export function useRole() {
  const user = useAuthStore((s) => s.user)

  return useMemo(() => {
    const role: Role | null = user?.role ?? null
    const isAdmin = role === 'admin'
    const isTeacher = role === 'teacher'
    const isStudent = role === 'student'
    const isStaff = isAdmin || isTeacher

    // Capability mirror (cosmetic only; protects no data).
    const canEditApp = (app: App) => isAdmin || app.userId === user?.userId
    const canOperateDeployment = (d: Deployment) => isAdmin || d.userId === user?.userId
    const canEditCourse = (c: Course) =>
      isAdmin ||
      ((c as Course & { teacherIds?: string[] }).teacherIds?.includes(user?.userId ?? '') ?? false)

    return {
      role,
      isAdmin,
      isTeacher,
      isStudent,
      isStaff,
      canEditApp,
      canDeleteApp: canEditApp,
      canSubmitAppVersion: canEditApp,
      canApproveApp: isAdmin,
      canOperateDeployment,
      canEditCourse,
      canChangeUserRole: isAdmin,
    }
  }, [user])
}
