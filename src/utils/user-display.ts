import type { User } from '@/types'

/** Name for greetings: the first name, else the capitalised username, else ''. */
export function greetingNameOf(
  user: Pick<User, 'firstName' | 'username'> | null | undefined,
): string {
  const firstName = user?.firstName?.trim()
  if (firstName) return firstName
  const username = user?.username ?? ''
  return username.charAt(0).toUpperCase() + username.slice(1)
}
