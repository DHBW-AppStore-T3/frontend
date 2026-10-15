import type { User } from '@/types'

/** Name shown for a student in lists and chips. */
export function displayNameOf(student: User): string {
  if (student.firstName || student.lastName) {
    return `${student.firstName || ''} ${student.lastName || ''}`.trim()
  }
  return student.username || student.email || student.keycloak_id || ''
}

/** A course counts as selected when it has students and all of them are selected. */
export function isCourseFullySelected(courseStudentIds: string[], selectedIds: string[]): boolean {
  return courseStudentIds.length > 0 && courseStudentIds.every((id) => selectedIds.includes(id))
}

/** Select all students of a course (no duplicates), or deselect them when already all selected. */
export function toggleCourseSelection(selectedIds: string[], courseStudentIds: string[]): string[] {
  if (isCourseFullySelected(courseStudentIds, selectedIds)) {
    return selectedIds.filter((id) => !courseStudentIds.includes(id))
  }
  return [...new Set([...selectedIds, ...courseStudentIds])]
}

/** Toggle one id in a list; blank ids are ignored. */
export function toggleId(ids: string[], id: string): string[] {
  if (!id || !id.trim()) return ids
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]
}

/** Course ids whose members are all part of the current selection. */
export function deriveCourseIds(
  courseIds: string[],
  membersByCourse: Map<string, string[]>,
  selectedIds: string[],
): string[] {
  return courseIds.filter((id) => {
    const members = membersByCourse.get(id)
    return members !== undefined && isCourseFullySelected(members, selectedIds)
  })
}

/**
 * Merge students into a cache keyed by keycloak id. Existing entries are only
 * replaced when the new object carries more information (first/last name).
 */
export function mergeIntoCache(cache: Map<string, User>, students: User[]): Map<string, User> {
  const next = new Map(cache)
  for (const s of students || []) {
    const id = s?.keycloak_id
    if (!id || typeof id !== 'string' || !id.trim()) continue
    const existing = next.get(id)
    if (!existing || (s.firstName && !existing.firstName) || (s.lastName && !existing.lastName)) {
      next.set(id, s)
    }
  }
  return next
}
