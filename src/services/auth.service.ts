import { userApi } from '@/api/user.api'
import type { User } from '@/types'

// localStorage is unavailable when the app runs in a third-party iframe
// (the Moodle LTI embed) with storage access blocked. Every access is wrapped
// so a SecurityError degrades to an in-memory-only session instead of aborting.
function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage blocked in embedded iframe — skip persistence */
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* storage blocked in embedded iframe — nothing to clear */
  }
}

// ----------------------------------------------------------------
// AUTH SERVICE (Keycloak Integration)
// ----------------------------------------------------------------
export class AuthService {
  /**
   * Fetch current user from backend API
   * Backend validates Keycloak token and returns user info
   */
  static async fetchMe(): Promise<User> {
    const { data: user } = await userApi.getMe()
    safeSet('user', JSON.stringify(user))
    return user
  }

  /**
   * Get stored user from localStorage
   */
  static getStoredUser(): User | null {
    const userStr = safeGet('user')
    if (!userStr) return null

    try {
      return JSON.parse(userStr) as User
    } catch {
      return null
    }
  }

  /**
   * Clear stored user data
   */
  static clearStoredUser(): void {
    safeRemove('user')
  }
}
