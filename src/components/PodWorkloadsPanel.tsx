/**
 * The Infrastructure panel of a pod deployment: one row per workload (a
 * team's or a person's pod), read live from the cluster.
 *
 * Restart replaces the pod and keeps its data; reset also deletes the
 * workload's volume, so the parent asks before it acts. Both are offered only
 * with the operate right and while the API allows a redeploy.
 *
 * Owner view only — the parent decides that; the backend gates the
 * underlying endpoint the same way.
 */
import { useTranslation } from 'react-i18next'
import { Boxes, RefreshCw, AlertCircle, RotateCcw, Eraser, ExternalLink } from 'lucide-react'
import type { PodSetupProgress, PodWorkload } from '@/types'
import { safeHttpUrl } from '@/utils/safe-url'
import { etaParts } from '@/utils/resources'

export interface PodWorkloadsPanelProps {
  workloads: PodWorkload[]
  loading: boolean
  error: string | null
  /** False when the cluster could not be asked (the list is then empty). */
  live: boolean
  /** Restart/reset buttons: operate right and redeploy allowed right now. */
  canAct: boolean
  /** Workloads with a restart or reset in flight. */
  busy: Set<string>
  onRefresh: () => void
  onRestart: (workload: string) => void
  onReset: (workload: string) => void
}

const TONE_READY = 'bg-green-100 text-green-800 border-green-300'
const TONE_STOPPED = 'bg-slate-100 text-slate-700 border-slate-300'
const TONE_STARTING = 'bg-yellow-100 text-yellow-800 border-yellow-300'
const TONE_FAILED = 'bg-red-100 text-red-800 border-red-300'
const STARTING_PHASES = ['Pending', 'ContainerCreating', 'PodInitializing']

export function phaseTone(workload: Pick<PodWorkload, 'ready' | 'phase'>): string {
  if (workload.ready) return TONE_READY
  if (workload.phase === 'Stopped') return TONE_STOPPED
  return STARTING_PHASES.includes(workload.phase) ? TONE_STARTING : TONE_FAILED
}

/** The second bar: what the app does after it started (an installer), with the time it expects to need. */
function SetupProgress({ name, setup }: { name: string; setup: PodSetupProgress }) {
  const { t } = useTranslation()
  const percent = Math.min(100, Math.max(0, Math.round(setup.percent)))
  const eta = setup.etaSeconds != null ? etaParts(setup.etaSeconds) : null
  let remaining: string
  if (setup.etaSeconds == null) remaining = t('pods.setup.etaUnknown')
  else if (eta == null) remaining = t('pods.setup.etaSoon')
  else if (eta.hours > 0) remaining = t('pods.setup.etaHours', { hours: eta.hours, minutes: eta.minutes })
  else remaining = t('pods.setup.etaMinutes', { minutes: eta.minutes })
  return (
    <div className="mt-1.5" data-testid={`setup-${name}`}>
      <div className="flex justify-between gap-2 text-[11px] text-textHeading">
        <span className="truncate" title={setup.step ?? ''}>
          {t('pods.setup.title')}
          {setup.step ? `: ${setup.step}` : ''}
        </span>
        <span className="tabular-nums whitespace-nowrap">
          {percent} % · {remaining}
        </span>
      </div>
      <div
        className="mt-0.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden"
        role="progressbar"
        aria-label={t('pods.setup.title')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full bg-info transition-all" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function WorkloadRow({
  workload,
  canAct,
  busy,
  onRestart,
  onReset,
}: { workload: PodWorkload; busy: boolean } & Pick<PodWorkloadsPanelProps, 'canAct' | 'onRestart' | 'onReset'>) {
  const { t, i18n } = useTranslation()
  const name = workload.workload
  const url = safeHttpUrl(workload.url)
  const phaseKey = `pods.phase.${workload.phase}`
  // Phases without a translation show as Kubernetes names them.
  const phaseLabel = i18n.exists(phaseKey) ? t(phaseKey) : workload.phase

  return (
    <tr data-testid={`workload-${name}`}>
      <td className="py-2.5 pr-4 font-mono text-textHeading">
        {url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-info hover:underline">
            {name} <ExternalLink size={12} />
          </a>
        ) : (
          <span>{name}</span>
        )}
      </td>
      <td className="py-2.5 pr-4 text-textMuted">{workload.team || '–'}</td>
      <td className="py-2.5 pr-4">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${phaseTone(workload)}`}>
          {phaseLabel}
        </span>
      </td>
      <td className={`py-2.5 pr-4 tabular-nums ${workload.restarts > 0 ? 'text-warning font-semibold' : 'text-textMuted'}`}>
        {workload.restarts}
      </td>
      <td className="py-2.5 pr-4 text-xs text-textMuted max-w-[320px]">
        {workload.ready ? (
          <span className="text-green-700 font-medium" data-testid={`started-${name}`}>
            {t('pods.started')}
          </span>
        ) : (
          <span className="block truncate" title={workload.lastEvent ?? ''}>
            {workload.lastEvent || '–'}
          </span>
        )}
        {workload.setup ? <SetupProgress name={name} setup={workload.setup} /> : null}
      </td>
      {canAct ? (
        <td className="py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              className="text-xs px-2 py-1 rounded border border-borderSubtle hover:bg-surfaceMuted inline-flex items-center gap-1 disabled:opacity-50"
              title={t('pods.restartTooltip')}
              data-testid={`restart-${name}`}
              onClick={() => onRestart(name)}
            >
              <RotateCcw size={12} /> {t('pods.restart')}
            </button>
            <button
              type="button"
              disabled={busy}
              className="text-xs px-2 py-1 rounded border border-danger/30 text-danger hover:bg-dangerTint inline-flex items-center gap-1 disabled:opacity-50"
              title={t('pods.resetTooltip')}
              data-testid={`reset-${name}`}
              onClick={() => onReset(name)}
            >
              <Eraser size={12} /> {t('pods.reset')}
            </button>
          </div>
        </td>
      ) : null}
    </tr>
  )
}

export default function PodWorkloadsPanel(props: PodWorkloadsPanelProps) {
  const { workloads, loading, error, live, canAct, busy, onRefresh, onRestart, onReset } = props
  const { t } = useTranslation()

  return (
    <div className="bg-white rounded-xl border border-borderSubtle p-6 shadow-sm mb-8" data-testid="pod-workloads">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-surfaceMuted rounded-lg">
            <Boxes size={20} className="text-textMuted" />
          </div>
          <span className="text-lg font-semibold text-textHeading">{t('pods.title')}</span>
          <span className="px-2 py-0.5 bg-surfaceMuted text-textMuted text-xs font-bold rounded">{workloads.length}</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-borderSubtle hover:bg-surfaceMuted disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
          title={t('pods.refreshTooltip')}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {t('pods.refresh')}
        </button>
      </div>

      {error ? (
        <div className="flex items-start gap-2 text-sm text-danger bg-dangerTint border border-danger/30 rounded-lg p-3 mb-4">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : !live && !loading ? (
        <p className="text-sm text-textMuted">{t('pods.notLive')}</p>
      ) : workloads.length === 0 && !loading ? (
        <p className="text-sm text-textMuted">{t('pods.none')}</p>
      ) : null}

      {workloads.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borderSubtle text-left text-xs text-textMuted uppercase tracking-wide">
                <th className="pb-2 pr-4">{t('pods.workload')}</th>
                <th className="pb-2 pr-4">{t('pods.team')}</th>
                <th className="pb-2 pr-4">{t('pods.state')}</th>
                <th className="pb-2 pr-4">{t('pods.restarts')}</th>
                <th className="pb-2 pr-4">{t('pods.lastEvent')}</th>
                {canAct ? <th className="pb-2">{t('pods.actions')}</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-borderSubtle">
              {workloads.map((workload) => (
                <WorkloadRow
                  key={workload.workload}
                  workload={workload}
                  canAct={canAct}
                  busy={busy.has(workload.workload)}
                  onRestart={onRestart}
                  onReset={onReset}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}
