/** Tailwind classes of the small role pill, by role. */
export function roleBadgeClass(role: string | undefined): string {
  switch (role) {
    case 'admin':
      return 'bg-dangerTint text-red-700'
    case 'teacher':
      return 'bg-purple-50 text-purple-700'
    default:
      return 'bg-infoTint text-blue-700'
  }
}

/** First letter of the username for the avatar circle (``?`` when unknown). */
export function avatarInitial(username: string | undefined): string {
  return (username || '?').charAt(0).toUpperCase()
}
