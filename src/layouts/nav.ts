import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  /** i18n key of the label. */
  label: string
  icon: LucideIcon
}
