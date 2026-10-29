import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil } from 'lucide-react'
import './SummaryCards.css'

/** The tinted square at the start of a card; decoration, the title names the card. */
export function CardBadge({ children }: { children: ReactNode }) {
  return (
    <span className="summary-badge" aria-hidden="true">
      {children}
    </span>
  )
}

/**
 * "Bearbeiten" of a card: the word on wide screens, a pencil on narrow ones. The label names where it
 * leads (the step), the visible word stays part of it.
 */
export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button type="button" className="summary-edit" aria-label={label} onClick={onClick}>
      <Pencil size={14} aria-hidden="true" />
      <span className="summary-edit__text">{t('deployment.summary.editBtn')}</span>
    </button>
  )
}
