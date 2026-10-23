/**
 * The Infrastructure panel of the deployment detail page: per-VM cards plus
 * read-only network and security-group listings.
 *
 * Split out of DeploymentDetailView, which owned this alongside the header,
 * groups, variables, live task progress, teams, task history and three
 * confirm modals.
 *
 * Owner-only. The parent decides that -- the backend gates the underlying
 * endpoint the same way, and a component that renders nothing is a worse
 * boundary than one the caller does not mount.
 */
import { Server, RefreshCw, AlertCircle, Network, Shield } from 'lucide-react'

import InfrastructureVmCard from '@/components/InfrastructureVmCard'
import type { DeploymentResource } from '@/types'

export interface DeploymentInfrastructurePanelProps {
  vmResources: DeploymentResource[]
  networkResources: DeploymentResource[]
  securityResources: DeploymentResource[]
  resourcesLoading: boolean
  resourcesError: string | null
  /** Addresses with a redeploy in flight, so their cards can show a spinner. */
  redeployInFlight: Set<string>
  /** Address of the VM whose detail drawer is open, if any. */
  openDrawerAddress: string | null
  /** Operate right and the lifecycle allows a redeploy right now. */
  canRedeploy?: boolean
  onRefresh: () => void
  onOpenVm: (address: string) => void
  onRedeployVm: (address: string) => void
}

export default function DeploymentInfrastructurePanel({
  vmResources,
  networkResources,
  securityResources,
  resourcesLoading,
  resourcesError,
  redeployInFlight,
  openDrawerAddress,
  canRedeploy = true,
  onRefresh,
  onOpenVm,
  onRedeployVm,
}: DeploymentInfrastructurePanelProps) {
  return (
    // Visually mirrors the page's other sections (Teams, Tasks, Outputs): same
    // shell, icon-tile header and sub-section spacing.
    <div className="bg-white rounded-xl border border-borderSubtle p-6 shadow-sm mb-8">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-surfaceMuted rounded-lg">
            <Server size={20} className="text-textMuted" />
          </div>
          <span className="text-lg font-semibold text-textHeading">Infrastruktur</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={resourcesLoading}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-borderSubtle hover:bg-surfaceMuted disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
          title="Live-Status neu abfragen"
        >
          <RefreshCw size={13} className={resourcesLoading ? 'animate-spin' : ''} />
          Aktualisieren
        </button>
      </div>

      {resourcesError ? (
        <div className="text-sm p-3 rounded-lg border bg-dangerTint text-red-800 border-danger/30 mb-4 flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{resourcesError}</p>
        </div>
      ) : null}

      {/* VMs — primary section, cards inherit their own visual styling from InfrastructureVmCard. */}
      <section className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Server size={14} className="text-textFaint" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-textMuted">
            Virtuelle Maschinen
          </h3>
          {vmResources.length > 0 ? (
            <span className="px-2 py-0.5 bg-surfaceMuted text-textMuted text-xs font-bold rounded">
              {vmResources.length}
            </span>
          ) : null}
        </div>
        {resourcesLoading && vmResources.length === 0 ? (
          <div className="text-sm text-textMuted italic px-4 py-6 bg-surfaceMuted rounded-lg border border-borderSubtle text-center">
            Lade VMs…
          </div>
        ) : vmResources.length === 0 ? (
          <div className="text-sm text-textMuted italic px-4 py-6 bg-surfaceMuted rounded-lg border border-borderSubtle text-center">
            Keine VMs im aktuellen Terraform-State.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {vmResources.map((vm) => (
              <InfrastructureVmCard
                key={vm.address}
                resource={vm}
                redeploying={redeployInFlight.has(vm.address)}
                isExpanded={openDrawerAddress === vm.address}
                canRedeploy={canRedeploy}
                onOpenDetails={onOpenVm}
                onRedeploy={onRedeployVm}
              />
            ))}
          </div>
        )}
      </section>

      {/* Networks / Subnets / Floating IPs (read-only) */}
      {networkResources.length > 0 ? (
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Network size={14} className="text-textFaint" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-textMuted">Netzwerk</h3>
            <span className="px-2 py-0.5 bg-surfaceMuted text-textMuted text-xs font-bold rounded">
              {networkResources.length}
            </span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {networkResources.map((res) => (
              <li
                key={res.address}
                className="px-3 py-2 bg-surfaceMuted rounded-lg border border-borderSubtle flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-textHeading truncate">{res.display_name}</p>
                  <p className="text-textMuted font-mono truncate" title={res.address}>
                    {res.address}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-borderSubtle text-textMuted ml-2 shrink-0">
                  {res.category}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Security Groups (read-only) */}
      {securityResources.length > 0 ? (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Shield size={14} className="text-textFaint" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-textMuted">Sicherheit</h3>
            <span className="px-2 py-0.5 bg-surfaceMuted text-textMuted text-xs font-bold rounded">
              {securityResources.length}
            </span>
          </div>
          <ul className="space-y-1.5 text-xs">
            {securityResources.map((res) => (
              <li
                key={res.address}
                className="px-3 py-2 bg-surfaceMuted rounded-lg border border-borderSubtle"
              >
                <p className="font-semibold text-textHeading">{res.display_name}</p>
                <p className="text-textMuted font-mono">{res.address}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
