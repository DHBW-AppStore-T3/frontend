import { useId, useRef, useState, useEffect, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, FileArchive, Info, TriangleAlert, Users, X } from 'lucide-react'
import type { AppVariable, DeploymentFile } from '@/types'
import FileDropArea from './FileDropArea'
import FileRecipients from './FileRecipients'
import {
  DEPLOYMENT_FILES_MAX_BYTES,
  fileExtensionLabel,
  formatFileSize,
  humanizeName,
  validateUpload,
  type UploadCheck,
} from './fileLimits'
import { buildRecipients } from './recipientRows'
import { readDeploymentFile } from './readDeploymentFile'
import { displayDescription, type WizardTeam } from './variableForm'
import './FileVariableCard.css'

type Mode = 'all' | 'each'
/** Where a picked or dropped file goes: to every recipient, or to one row. */
type Target = { all: true } | { id: string }

interface Props {
  variable: AppVariable
  teams: WizardTeam[]
  nameOf: (userId: string) => string
  getFileSlot: (varName: string, slot: string) => DeploymentFile | null
  /** Several slots at once: one store update for "one file for everybody". */
  setFileSlots: (varName: string, updates: Record<string, DeploymentFile | null>) => void
  /** Bytes of the files of the deployment's other file variables (they count against the total). */
  otherBytes?: number
}

const sameFile = (a: DeploymentFile | null, b: DeploymentFile | null): boolean =>
  !!a && !!b && a.name === b.name && a.size === b.size && a.content_b64 === b.content_b64

/**
 * A file variable of the app: one card instead of a drop zone per team. By default one file goes to
 * everybody; "different for each person" is the deliberate exception. The file is checked when it is
 * picked (type, size, total), not when the deployment starts.
 */
export default function FileVariableCard({ variable, teams, nameOf, getFileSlot, setFileSlots, otherBytes = 0 }: Props) {
  const { t, i18n } = useTranslation()
  const language = i18n.language
  const ids = useId()
  const rootRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropPickRef = useRef<HTMLButtonElement>(null)
  const radioRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ all: null, each: null })
  const target = useRef<Target | null>(null)

  const { kind, rows } = buildRecipients(variable, teams, nameOf)
  const files: Record<string, DeploymentFile | null> = Object.fromEntries(rows.map((r) => [r.id, getFileSlot(variable.name, r.id)]))
  const filledRows = rows.filter((r) => files[r.id])
  const first = rows.length > 0 ? files[rows[0]!.id]! : null
  const uniform = rows.length > 0 && filledRows.length === rows.length && rows.every((r) => sameFile(files[r.id]!, first))
  const ownBytes = filledRows.reduce((sum, r) => sum + files[r.id]!.size, 0)
  const rowKind = kind === 'team' ? 'team' : 'person'

  // On entering the step: one file for everybody, unless the files already differ.
  const [mode, setMode] = useState<Mode>(() => (filledRows.length > 0 && !uniform && kind !== 'all' ? 'each' : 'all'))
  const [descOpen, setDescOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState('')
  const [popIds, setPopIds] = useState<string[]>([])

  useEffect(() => {
    if (popIds.length === 0) return
    const timer = window.setTimeout(() => setPopIds([]), 900)
    return () => window.clearTimeout(timer)
  }, [popIds])

  const type = (() => {
    const ext = fileExtensionLabel(variable.fileExtensions)
    return ext ? t('deployment.fileVariable.typeNamed', { ext }) : t('deployment.fileVariable.typeAny')
  })()
  const audience =
    kind === 'all'
      ? t('deployment.fileVariable.audienceAll')
      : t(kind === 'team' ? 'deployment.fileVariable.audienceTeams' : 'deployment.fileVariable.audiencePeople', { count: rows.length })
  const description = displayDescription(variable)
  const title = variable.label ?? humanizeName(variable.name)

  const say = (text: string) => setLive(text)
  const fail = (message: string) => {
    setError(message)
    say(message)
  }

  const messageFor = (check: Exclude<UploadCheck, { ok: true }>, file: File): string => {
    if (check.code === 'type') {
      return check.extensions.length === 1
        ? t('deployment.fileVariable.errors.type', { name: file.name, type, ext: check.extensions[0] })
        : t('deployment.fileVariable.errors.typeMany', { name: file.name, list: check.extensions.map((e) => `.${e}`).join(', ') })
    }
    if (check.code === 'size') return t('deployment.fileVariable.errors.size', { name: file.name })
    const max = formatFileSize(DEPLOYMENT_FILES_MAX_BYTES, language)
    if (check.mode === 'slot' || check.slotCount === 1) {
      return t('deployment.fileVariable.errors.totalSlot', { total: formatFileSize(check.total, language), max })
    }
    return t(kind === 'team' ? 'deployment.fileVariable.errors.totalAllTeams' : 'deployment.fileVariable.errors.totalAllPeople', {
      count: check.slotCount,
      size: formatFileSize(file.size, language),
      total: formatFileSize(check.total, language),
      max,
      fit: formatFileSize(check.fitBytes, language),
    })
  }

  const receive = async (to: Target, file: File) => {
    const check = validateUpload({
      file,
      extensions: variable.fileExtensions,
      slotCount: rows.length,
      otherBytes,
      ...('all' in to ? {} : { filledBytes: ownBytes, slotBytes: files[to.id]?.size ?? 0 }),
    })
    if (!check.ok) {
      fail(messageFor(check, file))
      return
    }
    let payload: DeploymentFile
    try {
      payload = await readDeploymentFile(file)
    } catch {
      fail(t('deployment.fileVariable.readError'))
      return
    }
    setError(null)
    const slots = 'all' in to ? rows.map((r) => r.id) : [to.id]
    setFileSlots(variable.name, Object.fromEntries(slots.map((id) => [id, payload])))
    setPopIds(slots)
    if ('all' in to) say(t('deployment.fileVariable.live.all', { name: payload.name, audience }))
    else say(t('deployment.fileVariable.live.slot', { name: payload.name, recipient: rows.find((r) => r.id === to.id)?.name ?? '' }))
  }

  const pick = (to: Target) => {
    target.current = to
    inputRef.current?.click()
  }

  const focusLater = (find: () => HTMLElement | null | undefined) => {
    window.setTimeout(() => find()?.focus(), 0)
  }

  const removeEverywhere = () => {
    setFileSlots(variable.name, Object.fromEntries(rows.map((r) => [r.id, null])))
    setError(null)
    say(t('deployment.fileVariable.live.removedAll'))
    focusLater(() => dropPickRef.current)
  }
  const removeRow = (id: string) => {
    setFileSlots(variable.name, { [id]: null })
    setError(null)
    say(t('deployment.fileVariable.live.removed'))
    focusLater(() => Array.from(rootRef.current?.querySelectorAll<HTMLElement>('[data-pick]') ?? []).find((el) => el.dataset.pick === id))
  }

  const choose = (next: Mode) => {
    setMode(next)
    setError(null)
  }
  const onRadioKey = (event: KeyboardEvent) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const next: Mode = mode === 'all' ? 'each' : 'all'
    choose(next)
    radioRefs.current[next]?.focus()
  }

  const eachLabel = kind === 'team' ? 'deployment.fileVariable.mode.eachTeam' : 'deployment.fileVariable.mode.eachPerson'
  const helpText =
    mode === 'all'
      ? t(rowKind === 'team' ? 'deployment.fileVariable.help.allTeams' : 'deployment.fileVariable.help.allPeople', { count: rows.length })
      : t(rowKind === 'team' ? 'deployment.fileVariable.help.eachTeam' : 'deployment.fileVariable.help.eachPerson')

  const totalBytes = ownBytes
  const maxText = formatFileSize(DEPLOYMENT_FILES_MAX_BYTES, language)
  const totalText =
    uniform && rows.length > 1
      ? t('deployment.fileVariable.total.uniform', { count: rows.length, size: formatFileSize(first!.size, language), total: formatFileSize(totalBytes, language), max: maxText })
      : t('deployment.fileVariable.total.mixed', {
          files: t('deployment.fileVariable.total.files', { count: filledRows.length }),
          total: formatFileSize(totalBytes, language),
          max: maxText,
        })
  const barPercent = Math.min(100, Math.round(((totalBytes + otherBytes) / DEPLOYMENT_FILES_MAX_BYTES) * 100))

  return (
    <section
      ref={rootRef}
      className="rounded-xl border border-borderSubtle bg-surface shadow-sm"
      data-testid="file-variable-card"
      data-variable={variable.name}
      aria-labelledby={`${ids}-title`}
    >
      <header className="flex flex-wrap items-start gap-4 px-6 pt-5 sm:flex-nowrap max-sm:px-[18px]">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-primaryFaint text-primaryDeep" aria-hidden="true">
          <FileArchive size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${ids}-title`} className="text-base font-bold text-textHeading">
            {title}
          </h2>
          {description ? (
            <>
              <button
                type="button"
                data-testid="file-desc-toggle"
                aria-expanded={descOpen}
                aria-controls={`${ids}-desc`}
                onClick={() => setDescOpen((v) => !v)}
                className="-ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-semibold text-primaryDark hover:bg-primaryFaint focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <span>{t(descOpen ? 'deployment.fileVariable.descHide' : 'deployment.fileVariable.descShow')}</span>
                <ChevronDown size={16} className="fv-desc__chev" aria-hidden="true" />
              </button>
              <div className="fv-desc" data-open={descOpen}>
                <div id={`${ids}-desc`} data-testid="file-desc" inert={!descOpen} className="fv-desc__clip">
                  <p className="max-w-[54ch] pb-0.5 pt-1 text-sm text-textStrong">{description}</p>
                </div>
              </div>
            </>
          ) : (
            <p data-testid="file-plain" className="mt-0.5 text-sm text-textStrong">
              {t('deployment.fileVariable.plain', { type })}
            </p>
          )}
        </div>
        <div className="flex flex-none max-sm:order-last max-sm:basis-full max-sm:pl-14">
          <span className="inline-flex items-center rounded-full bg-surfaceMuted px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-textStrong">
            {variable.required ? t('deployment.variables.required') : t('deployment.fileVariable.optional')}
          </span>
        </div>
      </header>

      <div className="grid gap-4 px-6 pb-6 pt-5 max-sm:px-[18px]">
        {rows.length === 0 ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">{t('deployment.variables.noTeamsConfigured')}</div>
        ) : (
          <>
            {kind !== 'all' ? (
              <>
                <div
                  role="radiogroup"
                  aria-label={t('deployment.fileVariable.mode.label')}
                  onKeyDown={onRadioKey}
                  className="grid grid-cols-2 gap-1 rounded-xl bg-surfaceMuted p-1"
                >
                  {(['all', 'each'] as const).map((m) => (
                    <button
                      key={m}
                      ref={(el) => {
                        radioRefs.current[m] = el
                      }}
                      type="button"
                      role="radio"
                      aria-checked={mode === m}
                      tabIndex={mode === m ? 0 : -1}
                      onClick={() => choose(m)}
                      className={`rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary max-sm:px-1.5 max-sm:text-[13px] ${
                        mode === m ? 'bg-surface font-bold text-primaryDeep shadow-sm' : 'font-semibold text-textStrong hover:text-textHeading'
                      }`}
                    >
                      {t(m === 'all' ? 'deployment.fileVariable.mode.all' : eachLabel)}
                    </button>
                  ))}
                </div>
                <p className="-mt-1.5 text-sm text-textStrong">{helpText}</p>
              </>
            ) : null}

            {error ? (
              <div
                role="alert"
                data-testid="file-error"
                className="flex items-start gap-2.5 rounded-md bg-dangerTint px-3 py-2.5 text-sm font-medium text-danger ring-1 ring-inset ring-danger/20"
              >
                <TriangleAlert size={16} className="mt-0.5 flex-none" aria-hidden="true" />
                <span className="flex-1">{error}</span>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  aria-label={t('deployment.fileVariable.errors.close')}
                  className="rounded-md p-0.5 text-danger focus-visible:outline focus-visible:outline-2 focus-visible:outline-danger"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
            ) : null}

            {mode === 'all' ? (
              uniform ? (
                <div
                  data-testid="file-card"
                  className="fv-file flex flex-wrap items-center gap-3.5 rounded-lg border border-primarySoft bg-primaryFaint px-4 py-3.5"
                >
                  <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-surface text-primaryDeep" aria-hidden="true">
                    <FileArchive size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold text-textHeading" title={first!.name}>
                      {first!.name}
                    </div>
                    <div className="text-sm tabular-nums text-textStrong">
                      {t('deployment.fileVariable.file.meta', { size: formatFileSize(first!.size, language), audience })}
                    </div>
                  </div>
                  <div className="flex flex-none items-center gap-1 max-sm:w-full max-sm:justify-end">
                    <button
                      type="button"
                      data-pick="all"
                      onClick={() => pick({ all: true })}
                      className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-primaryDark hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {t('deployment.fileVariable.file.replace')}
                    </button>
                    <button
                      type="button"
                      onClick={removeEverywhere}
                      className="rounded-md px-2.5 py-1.5 text-sm font-semibold text-textStrong hover:bg-surface/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {t('deployment.fileVariable.file.remove')}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {filledRows.length > 0 ? (
                    <div data-testid="file-mixed" className="flex items-start gap-2.5 rounded-md bg-surfaceMuted px-3 py-2.5 text-sm text-textStrong">
                      <Info size={16} className="mt-0.5 flex-none" aria-hidden="true" />
                      <span>{t(rowKind === 'team' ? 'deployment.fileVariable.mixed.team' : 'deployment.fileVariable.mixed.person')}</span>
                    </div>
                  ) : null}
                  <FileDropArea
                    title={t('deployment.fileVariable.drop.title', { type })}
                    hint={t('deployment.fileVariable.drop.hint', { audience })}
                    pickRef={dropPickRef}
                    onPick={() => pick({ all: true })}
                    onDropFile={(file) => void receive({ all: true }, file)}
                  />
                </>
              )
            ) : null}

            {kind !== 'all' ? (
              <FileRecipients
                rows={rows}
                files={files}
                mode={mode}
                kind={rowKind}
                popIds={popIds}
                onPick={(id) => pick({ id })}
                onDropFile={(id, file) => void receive({ id }, file)}
                onRemove={removeRow}
                onRemoveAll={removeEverywhere}
              />
            ) : null}

            {filledRows.length > 0 ? (
              <p data-testid="file-total" className="flex items-center gap-2.5 rounded-md bg-surfaceMuted px-3.5 py-2.5 text-[13px] leading-[19px] text-textStrong">
                <Users size={16} className="flex-none" aria-hidden="true" />
                <span>{totalText}</span>
                <span className="fv-total__bar ml-auto" aria-hidden="true">
                  <i style={{ width: `${barPercent}%` }} />
                </span>
              </p>
            ) : null}
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={variable.fileExtensions?.length ? variable.fileExtensions.map((e) => `.${e.replace(/^\./, '')}`).join(',') : undefined}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          const to = target.current ?? (mode === 'all' ? ({ all: true } as const) : null)
          target.current = null
          if (file && to) void receive(to, file)
        }}
      />
      <div data-testid="file-live" aria-live="polite" className="sr-only">
        {live}
      </div>
    </section>
  )
}
