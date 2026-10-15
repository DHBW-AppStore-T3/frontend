/**
 * One card per Compute-Instance in the Infrastructure tab.
 *
 * Renders the Stage-1 data the list endpoint ships: lifecycle state
 * (status + task_state combined into a single pill, fault message as
 * a red banner), hardware compact (flavor + RAM/vCPU/disk + AZ +
 * uptime), IPs per network. Two CTAs at the bottom — "Details"
 * opens the drawer for Stage-2, "Redeploy" prompts for confirmation
 * and dispatches the per-VM redeploy task.
 *
 * Visual posture:
 *   * ``drift === 'in_sync'`` → neutral grey border
 *   * ``drift === 'stale'``   → amber border + warn banner
 *   * ``drift === 'missing'`` → red border + prominent banner
 *
 * The redeploy button is the primary remediation for ``drift = missing``.
 */
import { useTranslation } from 'react-i18next'
import { RefreshCcw, AlertTriangle, Cpu, Network } from 'lucide-react'
import type { DeploymentResource } from '@/types'
import { formatUptime, pillToneClass, type PillTone } from '@/composables/useVmPresentation'

export interface InfrastructureVmCardProps {
  resource: DeploymentResource
  /** When the parent has a redeploy in flight for this resource, the
   *  button shows a spinner and is disabled. Identified by address
   *  because the parent owns the redeploy state, not the card. */
  redeploying?: boolean
  /** Whether the inline detail panel under this card is currently
   *  expanded. Drives the Details button label (``Details`` vs.
   *  ``Ausblenden``) and a subtle accent on the card border so the
   *  user sees which card the open panel belongs to. */
  isExpanded?: boolean
  onOpenDetails: (address: string) => void
  onRedeploy: (address: string) => void
}

export default function InfrastructureVmCard({
  resource,
  redeploying,
  isExpanded,
  onOpenDetails,
  onRedeploy,
}: InfrastructureVmCardProps) {
  const { t } = useTranslation()

  // --- Lifecycle pill ---
  // Combine ``status`` + ``task_state`` so ``ACTIVE · networking`` (a
  // freshly booting VM) is visually distinct from ``ACTIVE`` (fully
  // healthy). The colour palette is the only place the frontend
  // interprets OpenStack lifecycle vocabulary — keep it tight.
  const lc = resource.lifecycle
  const pillText = !lc
    ? 'unknown'
    : lc.task_state
      ? `${lc.status || 'unknown'} · ${lc.task_state}`
      : lc.status || 'unknown'

  let pillTone: PillTone = 'grey'
  if (lc?.status === 'ACTIVE') pillTone = 'green'
  else if (lc?.status === 'ERROR') pillTone = 'red'
  else if (lc?.status === 'BUILD' || lc?.status === 'REBUILD') pillTone = 'amber'
  // SHUTOFF / PAUSED / SUSPENDED / MIGRATING / ... — neutral

  // --- Drift banner ---
  // Three states, only two visible: ``in_sync`` shows nothing,
  // ``stale``/``missing`` show a banner that explains the gap.
  const driftBanner =
    resource.drift === 'missing'
      ? { tone: 'red' as const, title: t('vm.drift.missingTitle'), hint: t('vm.drift.missingHint') }
      : resource.drift === 'stale'
        ? { tone: 'amber' as const, title: t('vm.drift.staleTitle'), hint: t('vm.drift.staleHint') }
        : null

  // --- Uptime ---
  const uptime = formatUptime(resource.hardware?.launched_at)

  const hw = resource.hardware
  let flavorBrief: string | null = null
  if (hw) {
    const parts: string[] = []
    if (hw.flavor_name) parts.push(hw.flavor_name)
    if (hw.vcpus != null) parts.push(`${hw.vcpus} ${t('vm.units.vcpu')}`)
    if (hw.ram_mb != null) parts.push(`${(hw.ram_mb / 1024).toFixed(0)} ${t('vm.units.gb')} RAM`)
    if (hw.disk_gb != null) parts.push(`${hw.disk_gb} ${t('vm.units.gb')}`)
    flavorBrief = parts.length > 0 ? parts.join(' · ') : null
  }

  let cardBorderClass = 'border-borderSubtle'
  if (resource.drift === 'missing') cardBorderClass = 'border-red-300 ring-1 ring-red-100'
  else if (resource.drift === 'stale') cardBorderClass = 'border-amber-300'
  // Subtle accent when the detail panel underneath is open, so the
  // user instantly knows which card the panel belongs to.
  else if (isExpanded) cardBorderClass = 'border-gray-800 ring-1 ring-gray-200'

  return (
    <div
      className={`bg-white rounded-lg p-4 border-2 shadow-sm flex flex-col gap-3 transition-colors ${cardBorderClass}`}
    >
      {/* Header: Team-Badge + VM-Name + Lifecycle-Pill */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                resource.team
                  ? 'bg-infoTint text-blue-700 border-info/30'
                  : 'bg-surfaceMuted text-textMuted border-borderSubtle'
              }`}
            >
              {resource.team || t('vm.sharedTeam')}
            </span>
          </div>
          <h3 className="text-base font-bold text-textHeading truncate" title={resource.display_name}>
            {resource.display_name}
          </h3>
        </div>
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-1 rounded border whitespace-nowrap ${pillToneClass(pillTone)}`}
        >
          {pillText}
        </span>
      </div>

      {/* Drift banner */}
      {driftBanner ? (
        <div
          className={`text-xs p-2 rounded border flex items-start gap-2 ${
            driftBanner.tone === 'red'
              ? 'bg-dangerTint text-red-800 border-danger/30'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">{driftBanner.title}</p>
            <p className="mt-0.5">{driftBanner.hint}</p>
          </div>
        </div>
      ) : null}

      {/* Fault banner — only when status=ERROR */}
      {resource.lifecycle?.fault_message ? (
        <div className="text-xs p-2 rounded border bg-dangerTint text-red-800 border-danger/30">
          <p className="font-semibold mb-0.5">{t('vm.openstackFault')}</p>
          <p className="font-mono break-all">{resource.lifecycle.fault_message}</p>
        </div>
      ) : null}

      {/* Hardware row */}
      {flavorBrief || resource.hardware?.image_name ? (
        <div className="flex items-start gap-2 text-xs text-textMuted">
          <Cpu size={14} className="mt-0.5 shrink-0 text-textFaint" />
          <div className="space-y-0.5">
            {flavorBrief ? <p>{flavorBrief}</p> : null}
            {resource.hardware?.image_name ? (
              <p className="text-textMuted">Image: {resource.hardware.image_name}</p>
            ) : resource.hardware?.image_id ? (
              <p className="text-textMuted font-mono">
                Image-ID: {resource.hardware.image_id.slice(0, 8)}…
              </p>
            ) : null}
            {resource.hardware?.availability_zone ? (
              <p className="text-textMuted">AZ: {resource.hardware.availability_zone}</p>
            ) : null}
            {uptime ? (
              <p className="text-textMuted">
                {t('vm.uptimePrefix')} {uptime}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Addresses */}
      {resource.addresses.length > 0 ? (
        <div className="flex items-start gap-2 text-xs text-textMuted">
          <Network size={14} className="mt-0.5 shrink-0 text-textFaint" />
          <div className="space-y-1 flex-1 min-w-0">
            {resource.addresses.map((addr) => (
              <div
                key={`${resource.address}::${addr.network}`}
                className="flex flex-wrap items-baseline gap-1"
              >
                <span className="text-textMuted">{addr.network}:</span>
                {addr.fixed_ip ? <span className="font-mono">{addr.fixed_ip}</span> : null}
                {addr.floating_ip ? (
                  <span className="font-mono text-emerald-700">→ {addr.floating_ip}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Footer: actions */}
      <div className="flex gap-2 mt-1 pt-2 border-t border-borderSubtle">
        <button
          type="button"
          onClick={() => onOpenDetails(resource.address)}
          className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded border transition-colors ${
            isExpanded
              ? 'bg-gray-800 text-white border-gray-800 hover:bg-gray-700'
              : 'border-borderSubtle hover:bg-surfaceMuted'
          }`}
        >
          {isExpanded ? t('vm.actions.hideDetails') : t('vm.actions.showDetails')}
        </button>
        <button
          type="button"
          onClick={() => onRedeploy(resource.address)}
          disabled={redeploying}
          className={`flex-1 text-xs font-semibold py-1.5 px-3 rounded border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
            resource.drift === 'missing'
              ? 'bg-dangerTint text-red-700 border-danger/30 hover:bg-dangerTint'
              : 'bg-white text-red-700 border-danger/30 hover:bg-dangerTint'
          }`}
        >
          <RefreshCcw size={12} className={redeploying ? 'animate-spin' : ''} />
          {redeploying ? t('vm.actions.redeploying') : t('vm.actions.redeploy')}
        </button>
      </div>
    </div>
  )
}
