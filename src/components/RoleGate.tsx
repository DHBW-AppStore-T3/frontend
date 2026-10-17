import type { ReactNode } from 'react'
import { useRole } from '@/composables/useRole'

/**
 * Conditional wrapper for permission-gated content.
 *
 *   <RoleGate admin>…</RoleGate>          – only admins see the children
 *   <RoleGate staff>…</RoleGate>          – teacher + admin
 *   <RoleGate can={canEditApp(app)}>…</RoleGate>
 *
 * Capability checks (``can``) are evaluated by the parent and passed in as a
 * plain boolean; the gate stays thin and knows nothing about specific resources.
 */
export interface RoleGateProps {
  admin?: boolean
  staff?: boolean
  can?: boolean
  children?: ReactNode
}

export default function RoleGate({ admin, staff, can, children }: RoleGateProps) {
  const { isAdmin, isStaff } = useRole()

  let allow = true
  if (admin) allow = isAdmin
  else if (staff) allow = isStaff
  else if (can !== undefined) allow = can

  return allow ? <>{children}</> : null
}
