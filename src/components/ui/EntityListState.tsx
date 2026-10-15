/**
 * Unified loading / empty / content wrapper for entity-list pages.
 *
 * Three states, one component:
 *   * ``isLoading`` → centered ``Loader2`` spinner + optional text
 *   * ``isEmpty``   → centered icon + empty message + optional action
 *   * otherwise     → the children (the entity list itself)
 *
 * Why a component: every main page had its own variant — text-only
 * loading vs. spinner-only vs. spinner-with-text, icon-with-text vs.
 * just-text empty states, different paddings. Centralising the three
 * shapes here gives the whole app a consistent feel without each
 * page rebuilding the same div-with-Tailwind block.
 *
 * Order of precedence: ``isLoading`` wins over ``isEmpty``. That
 * matters because while data is being fetched, ``items.length === 0``
 * is also true, and you don't want to flash the "empty" CTA before
 * the spinner has had a chance to appear.
 */
import type { ReactNode } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'

export interface EntityListStateProps {
  /** Whether the page is currently fetching its first batch of data.
   *  Wins over ``isEmpty`` — see component docs. */
  isLoading?: boolean
  /** Whether the list of entities is empty AFTER loading has settled.
   *  Callers usually express this as
   *  ``!store.isLoading && store.items.length === 0``. */
  isEmpty?: boolean
  /** Lucide icon component for the empty state (e.g. ``Inbox``,
   *  ``GraduationCap``). Falls back to no icon — the empty message
   *  alone is still rendered. */
  icon?: LucideIcon
  /** Visible text for the empty state. */
  emptyMessage?: string
  /** Optional text shown next to the loading spinner. Leave undefined
   *  for pages where the title is self-explanatory. */
  loadingMessage?: string
  /** Optional call-to-action shown in the empty state (commonly a
   *  ``<BaseButton>`` mirroring the page-header create button). */
  emptyAction?: ReactNode
  children?: ReactNode
}

export default function EntityListState({
  isLoading,
  isEmpty,
  icon: Icon,
  emptyMessage,
  loadingMessage,
  emptyAction,
  children,
}: EntityListStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-textMuted">
        <Loader2 size={32} className="animate-spin text-primary" />
        {loadingMessage ? <p className="text-sm">{loadingMessage}</p> : null}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="entity-empty flex flex-col items-center justify-center text-center">
        {Icon ? <Icon size={64} className="text-textFaint mb-4" aria-hidden="true" /> : null}
        {emptyMessage ? <p className="text-textMuted mb-4">{emptyMessage}</p> : null}
        {emptyAction}
      </div>
    )
  }

  return <>{children}</>
}
