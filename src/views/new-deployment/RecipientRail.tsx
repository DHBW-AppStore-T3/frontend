import type { HTMLAttributes, ReactNode } from 'react'
import './RecipientRail.css'

export interface RailItem {
  id: string
  name: string
  /** A second line under the name (the members of a team). */
  sub?: string
  /** The dot is filled: this recipient has what it should get. */
  filled?: boolean
  /** The right column. It brings its own ``rail-row__right`` class to line up with the name on narrow screens. */
  right?: ReactNode
}

export type RailRowAttributes = HTMLAttributes<HTMLLIElement> & Record<`data-${string}`, string | boolean | undefined>

interface Props {
  items: RailItem[]
  'aria-label'?: string
  /** Extra attributes of a row: test ids, data attributes, style, drag handlers. */
  rowProps?: (item: RailItem, index: number) => RailRowAttributes
}

/**
 * A rail of recipients: one dot per row, joined by a line, the name (and a second line) beside it and
 * a free column on the right. Shared by the file card of the variables step and the summary.
 */
export default function RecipientRail({ items, 'aria-label': label, rowProps }: Props) {
  return (
    <ol aria-label={label}>
      {items.map((item, index) => (
        <li key={item.id} {...rowProps?.(item, index)} className="rail-row" data-has={!!item.filled}>
          <span className="rail-node" aria-hidden="true" />
          <div className="min-w-0">
            <b className="block truncate text-sm font-semibold text-textHeading">{item.name}</b>
            {item.sub ? <small className="block truncate text-xs text-textStrong">{item.sub}</small> : null}
          </div>
          {item.right}
        </li>
      ))}
    </ol>
  )
}
