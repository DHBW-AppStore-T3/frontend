import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { FileArchive, Lock, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { formatFileSize } from './fileLimits'
import RecipientRail from './RecipientRail'
import { CardBadge, EditButton } from './SummaryCard'
import type { SettingsRow } from './summaryRows'

interface Props {
  rows: SettingsRow[]
  onEdit: () => void
}

function RowValue({ row, language }: { row: SettingsRow; language: string }) {
  const { t } = useTranslation()

  switch (row.kind) {
    case 'resources': {
      const number = (n: number) => new Intl.NumberFormat(language).format(n)
      return (
        <>
          <div className="summary-ledger__line">
            <span className="summary-mini-plate" data-changed={row.changed}>
              <span>
                <b>{number(row.cpu)}</b>
                <i>{t('deployment.vm.expert.cpuUnit')}</i>
              </span>
              <span>
                <b>{row.memoryGb}</b>
                <i>{t('deployment.vm.expert.ramUnit')}</i>
              </span>
            </span>
            <span className="summary-chip" data-tone={row.changed ? 'changed' : undefined}>
              {t(row.changed ? 'deployment.vm.expert.changed' : 'deployment.vm.expert.recommended')}
            </span>
          </div>
          {row.total ? (
            <span>
              {t(row.unit === 'desktop' ? 'deployment.summary.rows.perDesktop' : 'deployment.summary.rows.perPod')} ·{' '}
              {t('deployment.summary.rows.totalFor', { count: row.total.people })}{' '}
              <b>
                {number(row.total.cpu)} {t('deployment.vm.expert.cpuUnit')} · {row.total.memoryGb} {t('deployment.vm.expert.ramUnit')}
              </b>
            </span>
          ) : null}
        </>
      )
    }

    case 'network':
      if (row.key === 'internet') {
        const NoteIcon = row.on ? TriangleAlert : Lock
        return (
          <>
            <span className="summary-pill" data-on={row.on}>
              {t(row.on ? 'deployment.vm.internet.stateOn' : 'deployment.vm.internet.stateOff')}
            </span>
            <span className="summary-note">
              <NoteIcon size={15} aria-hidden="true" />
              <span>{t(row.on ? 'deployment.vm.internet.noteOn' : 'deployment.vm.internet.noteOff')}</span>
            </span>
          </>
        )
      }
      return (
        <>
          <span className="summary-pill" data-on={row.on}>
            {t(row.on ? 'deployment.network.summaryOn' : 'deployment.network.summaryOff')}
          </span>
          <span>{t(`deployment.summary.rows.together.${row.unit}${row.on ? 'On' : 'Off'}`)}</span>
        </>
      )

    case 'file':
      if (row.state === 'none') return <span>{t('deployment.summary.rows.noFile')}</span>
      if (row.state === 'uniform') {
        return (
          <span className="summary-file">
            <FileArchive size={20} aria-hidden="true" />
            <span className="min-w-0">
              <b>{row.file.name}</b>
              <small>
                {formatFileSize(row.file.size, language)} · {t('deployment.summary.rows.forAll', { count: row.people })}
              </small>
            </span>
          </span>
        )
      }
      return (
        <>
          <span>
            {t('deployment.summary.rows.files', { count: row.count })} · {formatFileSize(row.bytes, language)}
          </span>
          <div className="w-full">
            <RecipientRail
              aria-label={row.label}
              items={row.recipients.map((r) => ({
                id: r.id,
                name: r.name,
                sub: r.sub,
                filled: !!r.file,
                right: (
                  <span className={`rail-row__right text-right text-sm tabular-nums ${r.file ? 'font-semibold text-textHeading' : ''}`}>
                    {r.file ? r.file.name : t('deployment.fileVariable.recipients.none')}
                  </span>
                ),
              }))}
            />
          </div>
        </>
      )

    case 'value':
      if (row.lines.length === 1 && row.lines[0]!.slot === null) return <b>{row.lines[0]!.text}</b>
      return (
        <ul className="summary-values">
          {row.lines.map((line) => (
            <li key={line.slot ?? line.text}>
              <span>{line.slot}</span>
              <b>{line.text}</b>
            </li>
          ))}
        </ul>
      )
  }
}

/** "Variablen-Konfiguration": what was set, one row each. There is no card when the app offers nothing to set. */
export default function SummarySettings({ rows, onEdit }: Props) {
  const { t, i18n } = useTranslation()
  const titleId = useId()
  if (rows.length === 0) return null

  return (
    <section className="summary-card summary-cfg" aria-labelledby={titleId} data-testid="summary-settings">
      <div className="summary-cfg__top">
        <CardBadge>
          <SlidersHorizontal size={20} />
        </CardBadge>
        <h2 id={titleId} className="summary-cfg__title">
          {t('deployment.summary.variablesConfigTitle')}
        </h2>
        <EditButton label={t('deployment.summary.edit.variables')} onClick={onEdit} />
      </div>
      <dl className="summary-ledger">
        {rows.map((row) => (
          <div key={row.id} className="summary-ledger__row" data-testid={`summary-row-${row.id}`}>
            <dt className="summary-ledger__label">{row.label}</dt>
            <dd className="summary-ledger__value">
              <RowValue row={row} language={i18n.language} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
