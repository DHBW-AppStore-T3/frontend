import { useState, type CSSProperties, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FileArchive, X } from 'lucide-react'
import type { DeploymentFile } from '@/types'
import { formatFileSize } from './fileLimits'
import RecipientRail from './RecipientRail'
import type { Recipient, RecipientKind } from './recipientRows'
import './FileVariableCard.css'

/** Above this many recipients a shared file shows only the first rows. */
const SHOW_COLLAPSED_ABOVE = 5
const SHOWN_COLLAPSED = 3
/** The filling animation is staggered for the first rows only. */
const MAX_STAGGER = 11

interface Props {
  rows: Recipient[]
  files: Record<string, DeploymentFile | null | undefined>
  /** ``all``: one file for everybody (read only), ``each``: a file per row. */
  mode: 'all' | 'each'
  kind: Exclude<RecipientKind, 'all'>
  /** Rows that just received a file: their dot fills in. */
  popIds: string[]
  onPick: (id: string) => void
  onDropFile: (id: string, file: File) => void
  onRemove: (id: string) => void
  onRemoveAll: () => void
}

/**
 * Who gets a file: a filled dot per recipient with a file, an empty ring without. With one file per
 * row each row also takes the file itself (pick, replace, remove, drop).
 */
export default function FileRecipients({ rows, files, mode, kind, popIds, onPick, onDropFile, onRemove, onRemoveAll }: Props) {
  const { t, i18n } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const each = mode === 'each'
  const language = i18n.language
  const showAll = each || expanded || rows.length <= SHOW_COLLAPSED_ABOVE
  const shown = showAll ? rows : rows.slice(0, SHOWN_COLLAPSED)
  const hidden = rows.length - shown.length
  const anyFile = rows.some((r) => files[r.id])

  const title = each
    ? t(kind === 'team' ? 'deployment.fileVariable.recipients.titleEachTeam' : 'deployment.fileVariable.recipients.titleEachPerson')
    : t('deployment.fileVariable.recipients.title')

  const onRowDrop = (id: string, event: DragEvent) => {
    event.preventDefault()
    setDragId(null)
    const file = event.dataTransfer?.files?.[0]
    if (file) onDropFile(id, file)
  }

  /** The right column of a row: the file (with pick, replace, remove) per row, or just its name for one shared file. */
  const rightOf = (row: Recipient) => {
    const file = files[row.id] ?? null
    if (!each) {
      return (
        <span className={`rail-row__right text-right text-sm tabular-nums ${file ? 'font-semibold text-textHeading' : 'text-textStrong'}`}>
          {file ? file.name : t('deployment.fileVariable.recipients.none')}
        </span>
      )
    }
    return (
      <div className="rail-row__right flex min-w-0 items-center justify-end gap-1">
        {file ? (
          <>
            <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-primaryFaint px-2.5 py-0.5 text-sm font-semibold text-primaryDeep">
              <FileArchive size={14} aria-hidden="true" className="flex-none" />
              <span className="max-w-[15ch] truncate max-sm:max-w-[20ch]" title={file.name}>
                {file.name}
              </span>
              <span className="whitespace-nowrap font-medium tabular-nums text-textStrong">{formatFileSize(file.size, language)}</span>
            </span>
            <button
              type="button"
              data-pick={row.id}
              onClick={() => onPick(row.id)}
              className="rounded-md px-2.5 py-1 text-sm font-semibold text-primaryDark hover:bg-primaryFaint focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {t('deployment.fileVariable.file.replace')}
            </button>
            <button
              type="button"
              onClick={() => onRemove(row.id)}
              aria-label={t('deployment.fileVariable.file.removeFor', { name: row.name })}
              className="rounded-lg p-1.5 text-textStrong hover:bg-surfaceMuted hover:text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </>
        ) : (
          <>
            <span className="text-sm text-textStrong">{t('deployment.fileVariable.recipients.none')}</span>
            <button
              type="button"
              data-pick={row.id}
              onClick={() => onPick(row.id)}
              className="rounded-full border-2 border-primary bg-surface px-3 py-1 text-sm font-bold text-primaryDark transition-colors hover:bg-primaryFaint focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {t('deployment.fileVariable.drop.pick')}
            </button>
          </>
        )}
      </div>
    )
  }

  return (
    <div data-testid="file-recipients">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-textStrong">{title}</span>
        {each && anyFile ? (
          <button
            type="button"
            data-testid="file-remove-all"
            onClick={onRemoveAll}
            className="rounded-md px-2 py-1 text-sm font-semibold text-textStrong hover:bg-surfaceMuted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {t('deployment.fileVariable.recipients.removeAll')}
          </button>
        ) : null}
      </div>

      <RecipientRail
        items={shown.map((row) => ({
          id: row.id,
          name: row.name,
          sub: row.sub,
          filled: !!files[row.id],
          right: rightOf(row),
        }))}
        rowProps={(item, index) => ({
          'data-testid': 'file-row',
          'data-id': item.id,
          'data-pop': popIds.includes(item.id),
          'data-dragging': each && dragId === item.id,
          style: { '--i': Math.min(index, MAX_STAGGER) } as CSSProperties,
          ...(each
            ? {
                onDragOver: (event: DragEvent) => {
                  event.preventDefault()
                  setDragId(item.id)
                },
                onDragLeave: (event: DragEvent) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragId(null)
                },
                onDrop: (event: DragEvent) => onRowDrop(item.id, event),
              }
            : {}),
        })}
      />

      {hidden > 0 ? (
        <button
          type="button"
          data-testid="file-more"
          onClick={() => setExpanded(true)}
          className="ml-[22px] mt-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-primaryDark hover:bg-primaryFaint focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t(kind === 'team' ? 'deployment.fileVariable.recipients.moreTeams' : 'deployment.fileVariable.recipients.morePeople', { count: hidden })}
        </button>
      ) : null}
      {expanded && !each && rows.length > SHOW_COLLAPSED_ABOVE ? (
        <button
          type="button"
          data-testid="file-less"
          onClick={() => setExpanded(false)}
          className="ml-[22px] mt-1 rounded-md px-2.5 py-1.5 text-sm font-semibold text-primaryDark hover:bg-primaryFaint focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        >
          {t('deployment.fileVariable.recipients.less')}
        </button>
      ) : null}
    </div>
  )
}
