import { useCallback, useEffect, useRef, useState, useEffectEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { courseApi } from '@/api/course.api'
import { userApi } from '@/api/user.api'
import { useToast } from '@/composables/useToast'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { extractErrorMessage } from '@/utils/http-error'
import type { Course, User } from '@/types'
import { mergeIntoCache } from './studentSelection'

const COURSE_PAGE_SIZE = 200
const INITIAL_STUDENT_LIMIT = 1000
const SEARCH_LIMIT = 50
const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 300

/**
 * Courses, students and the student cache of the wizard's first step.
 *
 *  - ``courses`` + lazily known member lists per course
 *  - ``students``: the initial student list, replaced by (debounced) search results
 *  - ``cache``: every student ever seen, keyed by keycloak id; mirrored into the
 *    deployment store so later wizard steps can resolve names.
 */
export function useStudentDirectory() {
  const { t } = useTranslation()
  const toast = useToast()

  const [courses, setCourses] = useState<Course[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [membersByCourse, setMembersByCourse] = useState<Map<string, string[]>>(new Map())
  const [loadingCourseIds, setLoadingCourseIds] = useState<Set<string>>(new Set())

  const [initialStudents, setInitialStudents] = useState<User[]>([])
  const [searchResults, setSearchResults] = useState<User[] | null>(null)
  const [query, setQuery] = useState('')
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [cache, setCache] = useState<Map<string, User>>(new Map())

  const remember = useCallback((students: User[]) => {
    setCache((prev) => mergeIntoCache(prev, students))
    // Later wizard steps read names from the store's cache.
    const shared = useDeploymentStore.getState().studentCache
    for (const [id, user] of mergeIntoCache(shared, students)) shared.set(id, user)
  }, [])

  // Member ids of a course; loads and caches them on first use.
  const loadCourseMembers = useCallback(
    async (courseId: string): Promise<string[]> => {
      setLoadingCourseIds((s) => new Set(s).add(courseId))
      try {
        const res = await courseApi.getById(courseId)
        const users = (res.data.users || []) as User[]
        remember(users)
        const ids = users.map((u) => u.userId)
        setMembersByCourse((m) => new Map(m).set(courseId, ids))
        return ids
      } catch (err) {
        console.error(`Failed to load students for course ${courseId}:`, err)
        return []
      } finally {
        setLoadingCourseIds((s) => {
          const next = new Set(s)
          next.delete(courseId)
          return next
        })
      }
    },
    [remember],
  )

  // Initial load: courses (then their members), plus the initial student list.
  const loadOnEntry = useEffectEvent(() => {
    let cancelled = false
    void (async () => {
      setLoadingCourses(true)
      try {
        const res = await courseApi.list(0, COURSE_PAGE_SIZE)
        if (cancelled) return
        const list = (res.data || []) as Course[]
        setCourses(list)
        void Promise.all(list.map((c) => loadCourseMembers(c.courseId)))
      } catch {
        if (!cancelled) toast.error(t('CoursesView.toasts.loadError'))
      } finally {
        if (!cancelled) setLoadingCourses(false)
      }

      setLoadingStudents(true)
      try {
        const res = await userApi.list({ role: 'student', limit: INITIAL_STUDENT_LIMIT })
        if (cancelled) return
        const list = (res.data || []) as User[]
        setInitialStudents(list)
        remember(list)
      } catch {
        if (!cancelled) toast.error(t('CourseDetailView.toasts.loadUsersError'))
      } finally {
        if (!cancelled) setLoadingStudents(false)
      }
    })()
    return () => {
      cancelled = true
    }
  })

  // Mount-only load; the store actions and `t` are read when the answers arrive.
  useEffect(() => loadOnEntry(), [])

  // Debounced search. Empty → initial list; a single character keeps the list.
  const latest = useRef({ toast, t, remember })
  useEffect(() => {
    latest.current = { toast, t, remember }
  })

  // The error toast of a failed search goes away with the next search. Only
  // that one: the toast store is shared, clearing it would also wipe load
  // errors and the wizard's validation hints.
  const searchErrorId = useRef<string | null>(null)
  const dismissSearchError = useCallback(() => {
    if (searchErrorId.current) useToastStore.getState().removeToast(searchErrorId.current)
    searchErrorId.current = null
  }, [])

  useEffect(() => {
    const q = query.trim()
    const timer = window.setTimeout(async () => {
      const { toast: toaster, t: translate, remember: rememberStudents } = latest.current
      if (!q) {
        setSearchResults(null)
        dismissSearchError()
        return
      }
      if (q.length < MIN_QUERY_LENGTH) {
        dismissSearchError()
        return
      }
      setLoadingStudents(true)
      try {
        const res = await userApi.search(q, SEARCH_LIMIT)
        dismissSearchError()
        const list = (res.data || []) as User[]
        setSearchResults(list)
        rememberStudents(list)
      } catch (err) {
        console.error('User search error:', err)
        dismissSearchError()
        searchErrorId.current = toaster.error(extractErrorMessage(err, translate('CourseDetailView.toasts.loadUsersError')))
      } finally {
        setLoadingStudents(false)
      }
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [query, dismissSearchError])

  return {
    courses,
    loadingCourses,
    membersByCourse,
    loadingCourseIds,
    loadCourseMembers,
    students: searchResults ?? initialStudents,
    query,
    setQuery,
    loadingStudents,
    cache,
  }
}
