import type { UserRole } from "@/types"

/**
 * Central role-label registry. Views call ``t(roleLabelKey(role))`` for a single
 * canonical translation per role that survives locale switches. Keys live in
 * ``i18n/locales/{de,en}.ts`` under ``roleLabels.*``.
 */
export function roleLabelKey(role: string | undefined | null): string {
  switch (role) {
    case "admin":
    case "teacher":
    case "student":
      return `roleLabels.${role}`
    default:
      return "roleLabels.unknown"
  }
}

/** Variant name for the ``<Badge>`` UI component. */
export function roleBadgeVariant(role: string | undefined | null): 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand' {
  switch (role) {
    case "admin":
      return "brand"
    case "teacher":
      return "info"
    case "student":
      return "success"
    default:
      return "neutral"
  }
}

export type { UserRole }
