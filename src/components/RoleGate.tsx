import type { ReactNode } from 'react'
import { useRole } from '@/composables/useRole'

/**
 * Conditional wrapper for permission-gated content.
 *
 *   <RoleGate admin>…</RoleGate>          – only admins see the children
 *   <RoleGate staff>…</RoleGate>          – teacher + admin
 *   <RoleGate adminView>…</RoleGate>      – admin with the admin-view switch on
 *   <RoleGate can={canEditApp(app)}>…</RoleGate>
 *
 * Capability checks (``can``) are evaluated by the parent and passed in as a
 * plain boolean; the gate stays thin and knows nothing about specific resources.
 */
export interface RoleGateProps {
  admin?: boolean
  staff?: boolean
  adminView?: boolean
  can?: boolean
  children?: ReactNode
}

export default function RoleGate({ admin, staff, adminView, can, children }: RoleGateProps) {
  const { isAdmin, isStaff, isAdminView } = useRole()

  let allow = true
  if (admin) allow = isAdmin
  else if (staff) allow = isStaff
  else if (adminView) allow = isAdminView
  else if (can !== undefined) allow = can

  return allow ? <>{children}</> : null
}
