/**
 * Compact scope indicator for the deployment-wizard variable cards.
 *
 * Wraps ``Badge`` with scope-specific copy:
 *   * ``team`` → brand badge "Pro Team" + ``Users`` icon
 *   * ``user`` → brand badge "Pro User" + ``User`` icon
 *   * ``all``/undefined → nothing rendered (the calm default)
 *
 * Accepts ``undefined`` so callers can pass ``v.varScope`` without a guard
 * (the backend omits it when "all").
 */
import { Users, User } from 'lucide-react'
import Badge from './Badge'

export default function ScopeBadge({ scope }: { scope?: 'all' | 'team' | 'user' }) {
  if (scope === 'team') {
    return (
      <Badge variant="brand">
        <Users size={12} className="mr-1" aria-hidden="true" />
        <span>Pro Team</span>
      </Badge>
    )
  }
  if (scope === 'user') {
    return (
      <Badge variant="brand">
        <User size={12} className="mr-1" aria-hidden="true" />
        <span>Pro User</span>
      </Badge>
    )
  }
  return null
}
