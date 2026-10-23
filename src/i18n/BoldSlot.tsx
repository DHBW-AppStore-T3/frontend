import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

const SLOT_TOKEN = '\u0000slot\u0000'

export interface BoldSlotProps {
  /** Message with one `{<slot>}` placeholder. */
  i18nKey: string
  /** Name of the placeholder, rendered bold as text (never as HTML). */
  slot: string
  value: string
  /** Further message parameters. */
  params?: Record<string, unknown>
  /** Show the value in a monospace font (identifiers such as workload names). */
  mono?: boolean
}

/**
 * A message that shows one user-controlled value in bold. The value is a text
 * child, so it can never inject markup (the Vue `<i18n-t>` slot, in React).
 */
export default function BoldSlot({ i18nKey, slot, value, params, mono }: BoldSlotProps) {
  const { t } = useTranslation()
  const parts = t(i18nKey, { ...params, [slot]: SLOT_TOKEN }).split(SLOT_TOKEN)

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <strong className={mono ? 'font-mono' : undefined}>{value}</strong> : null}
          {part}
        </Fragment>
      ))}
    </>
  )
}
