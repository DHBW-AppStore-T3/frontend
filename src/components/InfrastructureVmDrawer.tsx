/**
 * Inline detail panel for ONE VM, shown directly under the clicked
 * ``InfrastructureVmCard`` in the deployment-detail page's Infrastructure section.
 *
 * Renders as part of the parent's flow, like another card in the section.
 *
 * Layout: a rounded ``bg-white border shadow-sm`` card matching the surrounding
 * sections, with ``bg-surfaceMuted`` sub-cards per data group (Identity, Lifecycle,
 * Hardware, Addresses, Ports, SGs, Volumes, Metadata).
 *
 * The component owns its own fetch/loading/error state; the parent mounts it
 * with a target address and listens for ``onClose`` to collapse the panel.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X,
  RefreshCw,
  AlertTriangle,
  Server,
  Cpu,
  Network as NetworkIcon,
  Shield,
  HardDrive,
  Tag,
  Activity,
} from 'lucide-react'
import type { DeploymentResource } from '@/types'
import { deploymentApi } from '@/api/deployment.api'
import { formatUptime, pillToneClass, type PillTone } from '@/composables/useVmPresentation'

export interface InfrastructureVmDrawerProps {
  deploymentId: string
  address: string
  onClose: () => void
}

const SECTION = 'bg-surfaceMuted rounded-lg border border-borderSubtle p-4 space-y-3'
const COUNT = 'ml-auto text-[10px] font-bold bg-gray-200 text-textMuted px-2 py-0.5 rounded'
const SUB_CARD = 'text-xs bg-white rounded border border-borderSubtle p-2.5 space-y-1'

function SectionHeader({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <h4 className="text-sm font-semibold text-textMuted">{title}</h4>
      {children}
    </div>
  )
}

export default function InfrastructureVmDrawer({ deploymentId, address, onClose }: InfrastructureVmDrawerProps) {
  const { t } = useTranslation()

  // A request is identified by (deployment, address, refresh counter). Loading
  // is derived — "the latest result isn't for the current request yet" — so the
  // effect never has to set state synchronously.
  const [refreshNonce, setRefreshNonce] = useState(0)
  const requestKey = `${deploymentId}|${address}|${refreshNonce}`
  const [result, setResult] = useState<{
    key: string
    detail: DeploymentResource | null
    error: string | null
  }>({ key: '', detail: null, error: null })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await deploymentApi.getResourceDetail(deploymentId, address)
        if (!cancelled) setResult({ key: requestKey, detail: response.data, error: null })
      } catch (err: any) {
        // 404 — resource removed since the list was rendered. 412 — user lost
        // their OpenStack credentials between mount and click. Both are
        // surfaced inline; the page-level toast is reserved for harder errors.
        const status = err?.response?.status
        let message: string
        if (status === 404) message = t('vm.drawer.errors.notFound')
        else if (status === 412) message = t('vm.drawer.errors.missingCredentials')
        else if (status === 502) message = t('vm.drawer.errors.unreachable')
        else message = err?.message || t('vm.drawer.errors.generic')
        if (!cancelled) setResult((prev) => ({ key: requestKey, detail: prev.detail, error: message }))
      }
    })()
    return () => {
      cancelled = true
    }
    // `t` is intentionally not a dependency: a language switch must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey])

  const isLoading = result.key !== requestKey
  const detail = result.detail
  const errorMessage = isLoading ? null : result.error
  const load = () => setRefreshNonce((n) => n + 1)

  // --- Lifecycle pill colour (matches InfrastructureVmCard) ---
  const status = detail?.lifecycle?.status
  let lifecycleTone: PillTone = 'gray'
  if (status === 'ACTIVE') lifecycleTone = 'green'
  else if (status === 'ERROR') lifecycleTone = 'red'
  else if (status === 'BUILD' || status === 'REBUILD') lifecycleTone = 'amber'

  const uptime = formatUptime(detail?.hardware?.launched_at)

  // --- Map network IDs / fixed IPs to the human-friendly network name.
  // The Stage-2 ``ports`` block only carries the ``network_id`` (UUID).
  // The Stage-1 ``addresses`` block, on the other hand, is keyed by
  // the OpenStack-side network NAME (e.g. ``"NAT"``) and carries the
  // fixed_ip for that network. So we walk addresses: by fixed-ip first,
  // then by MAC as fallback.
  const portNetworkName = (port: { fixed_ip: string | null; mac: string | null }): string | null => {
    const addrs = detail?.addresses
    if (!addrs || addrs.length === 0) return null
    if (port.fixed_ip) {
      const m = addrs.find((a) => a.fixed_ip === port.fixed_ip)
      if (m) return m.network
    }
    if (port.mac) {
      const m = addrs.find((a) => a.mac === port.mac)
      if (m) return m.network
    }
    return null
  }

  return (
    // The outer container blends into the parent's Infrastruktur section: same
    // ``bg-white rounded-xl border shadow-sm`` shell as the deployment-page
    // cards. ``flex flex-col`` lets the body consume remaining height when the
    // parent constrains us via ``flex-1 min-h-0``; inline-card contexts just
    // grow naturally. ``overflow-hidden`` keeps the rounded corners intact.
    <div className="bg-white rounded-xl border border-borderSubtle shadow-sm overflow-hidden flex flex-col">
      {/* Header — icon tile + title + close button. */}
      <header className="shrink-0 px-5 py-4 border-b border-borderSubtle flex items-center justify-between gap-3 bg-gradient-to-r from-gray-50 to-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-white rounded-lg shrink-0 border border-borderSubtle">
            <Server size={18} className="text-textMuted" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-textMuted font-bold">
              {t('vm.drawer.title')}
            </p>
            <h3
              className="text-base font-semibold text-textHeading truncate"
              title={detail?.display_name || address}
            >
              {detail?.display_name || address}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={load}
            disabled={isLoading}
            className="p-2 text-textMuted hover:text-textHeading hover:bg-surfaceMuted rounded-lg disabled:opacity-50 transition-colors"
            title={t('vm.actions.refresh')}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-textMuted hover:text-textHeading hover:bg-surfaceMuted rounded-lg transition-colors"
            title={t('vm.actions.closeDetails')}
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Body — ``min-h-0`` lets a flex child shrink below its content's
          natural size so ``overflow-y-auto`` engages in a constrained parent. */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {isLoading && !detail ? (
          <div className="text-sm text-textMuted italic px-4 py-6 bg-surfaceMuted rounded-lg border border-borderSubtle text-center">
            {t('vm.drawer.loading')}
          </div>
        ) : errorMessage ? (
          <div className="text-sm p-3 rounded-lg border bg-dangerTint text-red-800 border-danger/30 flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        ) : detail ? (
          <>
            {/* Identity card */}
            <section className={SECTION}>
              <SectionHeader
                icon={<Tag size={14} className="text-textFaint" />}
                title={t('vm.drawer.sections.identity')}
              >
                {detail.team ? (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-infoTint text-blue-700 px-2 py-0.5 rounded border border-info/30">
                    {detail.team}
                  </span>
                ) : (
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider bg-surfaceMuted text-textMuted px-2 py-0.5 rounded border border-borderSubtle">
                    {t('vm.sharedTeam')}
                  </span>
                )}
              </SectionHeader>
              <div className="text-xs space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-textMuted w-20 shrink-0">{t('vm.drawer.address')}</span>
                  <code className="font-mono text-textHeading break-all">{detail.address}</code>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-textMuted w-20 shrink-0">{t('vm.drawer.osUuid')}</span>
                  <code className="font-mono text-textMuted break-all">{detail.provider_id}</code>
                </div>
              </div>
            </section>

            {/* Lifecycle card */}
            {detail.lifecycle ? (
              <section className={SECTION}>
                <SectionHeader
                  icon={<Activity size={14} className="text-textFaint" />}
                  title={t('vm.drawer.sections.lifecycle')}
                >
                  {detail.lifecycle.status ? (
                    <span
                      className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${pillToneClass(lifecycleTone)}`}
                    >
                      {detail.lifecycle.status}
                    </span>
                  ) : null}
                </SectionHeader>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-textMuted">{t('vm.drawer.lifecycle.taskState')}</span>
                    <p className="font-medium text-textHeading">{detail.lifecycle.task_state || '—'}</p>
                  </div>
                  <div>
                    <span className="text-textMuted">{t('vm.drawer.lifecycle.vmState')}</span>
                    <p className="font-medium text-textHeading">{detail.lifecycle.vm_state || '—'}</p>
                  </div>
                  <div>
                    <span className="text-textMuted">{t('vm.drawer.lifecycle.powerState')}</span>
                    <p className="font-medium text-textHeading">{detail.lifecycle.power_state || '—'}</p>
                  </div>
                  {uptime ? (
                    <div>
                      <span className="text-textMuted">{t('vm.uptimePrefix')}</span>
                      <p className="font-medium text-textHeading">{uptime}</p>
                    </div>
                  ) : null}
                </div>
                {detail.lifecycle.fault_message ? (
                  <div className="text-xs p-2 rounded border bg-dangerTint text-red-800 border-danger/30">
                    <p className="font-semibold mb-0.5">{t('vm.openstackFault')}</p>
                    <p className="font-mono break-all">{detail.lifecycle.fault_message}</p>
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* Hardware card */}
            {detail.hardware ? (
              <section className={SECTION}>
                <SectionHeader
                  icon={<Cpu size={14} className="text-textFaint" />}
                  title={t('vm.drawer.sections.hardware')}
                />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  <div>
                    <span className="text-textMuted">{t('vm.drawer.hardware.flavor')}</span>
                    <p className="font-medium text-textHeading">{detail.hardware.flavor_name || '—'}</p>
                  </div>
                  <div>
                    <span className="text-textMuted">{t('vm.units.vcpu')}</span>
                    <p className="font-medium text-textHeading">{detail.hardware.vcpus ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-textMuted">{t('vm.drawer.hardware.ram')}</span>
                    <p className="font-medium text-textHeading">
                      {detail.hardware.ram_mb != null ? `${detail.hardware.ram_mb} MB` : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-textMuted">{t('vm.drawer.hardware.disk')}</span>
                    <p className="font-medium text-textHeading">
                      {detail.hardware.disk_gb != null
                        ? `${detail.hardware.disk_gb} ${t('vm.units.gb')}`
                        : '—'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-textMuted">{t('vm.drawer.hardware.image')}</span>
                    <p className="font-medium text-textHeading break-all">
                      {detail.hardware.image_name ? (
                        <span>{detail.hardware.image_name}</span>
                      ) : detail.hardware.image_id ? (
                        <code className="font-mono text-xs">{detail.hardware.image_id}</code>
                      ) : (
                        <span>—</span>
                      )}
                    </p>
                  </div>
                  <div>
                    <span className="text-textMuted">{t('vm.drawer.hardware.az')}</span>
                    <p className="font-medium text-textHeading">
                      {detail.hardware.availability_zone || '—'}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {/* Network addresses card (high-level: one row per network name) */}
            {detail.addresses && detail.addresses.length > 0 ? (
              <section className={SECTION}>
                <SectionHeader
                  icon={<NetworkIcon size={14} className="text-textFaint" />}
                  title={t('vm.drawer.sections.addresses')}
                >
                  <span className={COUNT}>{detail.addresses.length}</span>
                </SectionHeader>
                <div className="space-y-2">
                  {detail.addresses.map((addr) => (
                    <div key={`${addr.network}::${addr.fixed_ip || addr.mac || ''}`} className={SUB_CARD}>
                      <p className="font-semibold text-textHeading">{addr.network}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-textMuted">
                        <div>
                          <span className="text-textMuted">{t('vm.drawer.network.fixedIp')}</span>
                          <code className="ml-1 font-mono">{addr.fixed_ip || '—'}</code>
                        </div>
                        {addr.floating_ip ? (
                          <div>
                            <span className="text-textMuted">{t('vm.drawer.network.floatingIp')}</span>
                            <code className="ml-1 font-mono text-emerald-700">{addr.floating_ip}</code>
                          </div>
                        ) : null}
                        {addr.mac ? (
                          <div>
                            <span className="text-textMuted">{t('vm.drawer.network.mac')}</span>
                            <code className="ml-1 font-mono">{addr.mac}</code>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Network ports card (low-level per-port detail) */}
            {detail.ports ? (
              <section className={SECTION}>
                <SectionHeader
                  icon={<NetworkIcon size={14} className="text-textFaint" />}
                  title={t('vm.drawer.sections.ports')}
                >
                  {detail.ports.length > 0 ? <span className={COUNT}>{detail.ports.length}</span> : null}
                </SectionHeader>
                {detail.ports.length === 0 ? (
                  <div className="text-xs text-textMuted italic">{t('vm.drawer.network.noPorts')}</div>
                ) : (
                  <div className="space-y-2">
                    {detail.ports.map((port) => {
                      const networkName = portNetworkName(port)
                      return (
                        <div key={port.port_id} className={SUB_CARD}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <code className="font-mono text-textMuted truncate" title={port.port_id}>
                                {port.port_id.slice(0, 8)}…
                              </code>
                              {networkName ? (
                                <span
                                  className="text-[10px] font-semibold bg-infoTint text-blue-700 border border-info/30 px-2 py-0.5 rounded"
                                  title={port.network_id || ''}
                                >
                                  {networkName}
                                </span>
                              ) : null}
                            </div>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap ${
                                port.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-surfaceMuted text-textMuted border-borderSubtle'
                              }`}
                            >
                              {port.status || 'unknown'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-textMuted">
                            <div>
                              <span className="text-textMuted">IP</span>
                              <code className="ml-1 font-mono">{port.fixed_ip || '—'}</code>
                            </div>
                            <div>
                              <span className="text-textMuted">{t('vm.drawer.network.mac')}</span>
                              <code className="ml-1 font-mono">{port.mac || '—'}</code>
                            </div>
                          </div>
                          {port.security_group_ids.length > 0 ? (
                            <p className="text-textMuted">
                              {t('vm.drawer.network.securityGroupCount', {
                                count: port.security_group_ids.length,
                              })}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {/* Security Groups card */}
            {detail.security_groups ? (
              <section className={SECTION}>
                <SectionHeader
                  icon={<Shield size={14} className="text-textFaint" />}
                  title={t('vm.drawer.sections.securityGroups')}
                >
                  {detail.security_groups.length > 0 ? (
                    <span className={COUNT}>{detail.security_groups.length}</span>
                  ) : null}
                </SectionHeader>
                {detail.security_groups.length === 0 ? (
                  <div className="text-xs text-textMuted italic">
                    {t('vm.drawer.network.noSecurityGroups')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detail.security_groups.map((sg) => (
                      <div key={sg.id} className={SUB_CARD}>
                        <p className="font-semibold text-textHeading">{sg.name}</p>
                        {sg.description ? <p className="text-textMuted">{sg.description}</p> : null}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[10px] font-semibold uppercase tracking-wider bg-infoTint text-blue-700 border border-info/30 px-2 py-0.5 rounded">
                            {sg.ingress_rules} {t('vm.drawer.network.ingress')}
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded">
                            {sg.egress_rules} {t('vm.drawer.network.egress')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {/* Volumes card */}
            {detail.volumes ? (
              <section className={SECTION}>
                <SectionHeader
                  icon={<HardDrive size={14} className="text-textFaint" />}
                  title={t('vm.drawer.sections.volumes')}
                >
                  {detail.volumes.length > 0 ? <span className={COUNT}>{detail.volumes.length}</span> : null}
                </SectionHeader>
                {detail.volumes.length === 0 ? (
                  <div className="text-xs text-textMuted italic">{t('vm.drawer.volumes.empty')}</div>
                ) : (
                  <div className="space-y-2">
                    {detail.volumes.map((vol) => (
                      <div key={vol.volume_id} className={SUB_CARD}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-textHeading truncate">
                            {vol.name || vol.volume_id.slice(0, 8) + '…'}
                          </p>
                          {vol.status ? (
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border whitespace-nowrap ${
                                vol.status === 'in-use'
                                  ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                  : 'bg-surfaceMuted text-textMuted border-borderSubtle'
                              }`}
                            >
                              {vol.status}
                            </span>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-textMuted">
                          {vol.size_gb != null ? (
                            <div>
                              <span className="text-textMuted">{t('vm.drawer.volumes.size')}</span>
                              <span className="ml-1 font-medium">
                                {vol.size_gb} {t('vm.units.gb')}
                              </span>
                            </div>
                          ) : null}
                          {vol.device ? (
                            <div>
                              <span className="text-textMuted">{t('vm.drawer.volumes.device')}</span>
                              <code className="ml-1 font-mono">{vol.device}</code>
                            </div>
                          ) : null}
                        </div>
                        {vol.bootable ? (
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                            {t('vm.drawer.volumes.bootable')}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {/* Metadata card */}
            {detail.metadata && Object.keys(detail.metadata).length > 0 ? (
              <section className={SECTION}>
                <SectionHeader
                  icon={<Tag size={14} className="text-textFaint" />}
                  title={t('vm.drawer.sections.metadata')}
                />
                <div className="space-y-1 text-xs">
                  {Object.entries(detail.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-baseline gap-2">
                      <code className="font-mono text-textMuted shrink-0">{key}</code>
                      <span className="text-textFaint">=</span>
                      <span className="text-textHeading break-all">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}
