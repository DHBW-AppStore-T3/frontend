import api from './axios'
import type {
  User,
  UserWithCourse,
  UserQueryParams,
} from '@/types'

// ----------------------------------------------------------------
// USER API
// ----------------------------------------------------------------
export const userApi = {
  /**
   * Get current user with course
   */
  getMe: () => {
    return api.get<UserWithCourse>('/users/me')
  },

  /**
   * Get all users (TEACHER/ADMIN only)
   */
  list: (params?: UserQueryParams) => {
    return api.get<User[]>('/users/', { params })
  },

  /**
   * Search users by username or email
   */
  search: (query: string, limit = 10) => {
    return api.get<User[]>('/users/search', { params: { query, limit } })
  },

  /**
   * Get user by ID
   */
  getById: (userId: string) => {
    return api.get<UserWithCourse>(`/users/${userId}`)
  },

}

// Removed: getStatistics, update, changePassword, delete.
//
// changePassword called POST /users/{id}/password and delete called
// DELETE /users/{id}; neither route exists on the backend, so both were
// a 404/405 waiting for a caller. Keycloak owns credentials and the
// users.password column was dropped in migration 2026_01_25_1609.
//
// getStatistics and update map to real routes (GET
// /users/{id}/statistics, PUT /users/{id}) but had no call site. The
// contract lives in the backend's OpenAPI schema, not in unused
// wrappers here -- re-add them from src/types/api.generated.ts when a
// view actually needs them.