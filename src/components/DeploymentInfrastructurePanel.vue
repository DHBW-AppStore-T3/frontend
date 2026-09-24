<script setup lang="ts">
/**
 * The Infrastructure panel of the deployment detail page: per-VM cards plus
 * read-only network and security-group listings.
 *
 * Split out of DeploymentDetailView.vue, which was ~2590 lines and owned this
 * alongside the header, groups, variables, live task progress, teams, task
 * history and three confirm modals.
 *
 * Owner-only. The parent decides that -- the backend gates the underlying
 * endpoint the same way, and a component that renders nothing is a worse
 * boundary than one the caller does not mount.
 */
import { Server, RefreshCw, AlertCircle, Network, Shield } from 'lucide-vue-next'

import InfrastructureVmCard from '@/components/InfrastructureVmCard.vue'
import type { DeploymentResource } from '@/types'

defineProps<{
    vmResources: DeploymentResource[]
    networkResources: DeploymentResource[]
    securityResources: DeploymentResource[]
    resourcesLoading: boolean
    resourcesError: string | null
    /** Addresses with a redeploy in flight, so their cards can show a spinner. */
    redeployInFlight: Set<string>
    /** Address of the VM whose detail drawer is open, if any. */
    openDrawerAddress: string | null
}>()

defineEmits<{
    (e: 'refresh'): void
    (e: 'open-vm', address: string): void
    (e: 'redeploy-vm', address: string): void
}>()
</script>

<template>
    <!-- Visually mirrors the page's other sections (Teams, Tasks,
         Outputs): same shell, icon-tile header and sub-section spacing. -->
    <div class="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
        <div class="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-gray-100 rounded-lg">
                    <Server :size="20" class="text-gray-600" />
                </div>
                <span class="text-lg font-semibold text-gray-900">Infrastruktur</span>
            </div>
            <button
                @click="$emit('refresh')"
                :disabled="resourcesLoading"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
                title="Live-Status neu abfragen"
            >
                <RefreshCw :size="13" :class="resourcesLoading ? 'animate-spin' : ''" />
                Aktualisieren
            </button>
        </div>

        <div
            v-if="resourcesError"
            class="text-sm p-3 rounded-lg border bg-red-50 text-red-800 border-red-200 mb-4 flex items-start gap-2"
        >
            <AlertCircle :size="16" class="mt-0.5 shrink-0" />
            <p>{{ resourcesError }}</p>
        </div>

        <!-- VMs — primary section, cards inherit their own visual
             styling from ``InfrastructureVmCard``. -->
        <section class="mb-6">
            <div class="flex items-center gap-2 mb-3">
                <Server :size="14" class="text-gray-400" />
                <h3 class="text-sm font-bold uppercase tracking-wider text-gray-600">
                    Virtuelle Maschinen
                </h3>
                <span
                    v-if="vmResources.length > 0"
                    class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded"
                >
                    {{ vmResources.length }}
                </span>
            </div>
            <div
                v-if="resourcesLoading && vmResources.length === 0"
                class="text-sm text-gray-500 italic px-4 py-6 bg-gray-50 rounded-lg border border-gray-100 text-center"
            >
                Lade VMs…
            </div>
            <div
                v-else-if="vmResources.length === 0"
                class="text-sm text-gray-500 italic px-4 py-6 bg-gray-50 rounded-lg border border-gray-100 text-center"
            >
                Keine VMs im aktuellen Terraform-State.
            </div>
            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InfrastructureVmCard
                    v-for="vm in vmResources"
                    :key="vm.address"
                    :resource="vm"
                    :redeploying="redeployInFlight.has(vm.address)"
                    :is-expanded="openDrawerAddress === vm.address"
                    @open-details="(a: string) => $emit('open-vm', a)"
                    @redeploy="(a: string) => $emit('redeploy-vm', a)"
                />
            </div>
        </section>

        <!-- Networks / Subnets / Floating IPs (read-only) -->
        <section v-if="networkResources.length > 0" class="mb-6">
            <div class="flex items-center gap-2 mb-3">
                <Network :size="14" class="text-gray-400" />
                <h3 class="text-sm font-bold uppercase tracking-wider text-gray-600">
                    Netzwerk
                </h3>
                <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">
                    {{ networkResources.length }}
                </span>
            </div>
            <ul class="space-y-1.5 text-xs">
                <li
                    v-for="res in networkResources"
                    :key="res.address"
                    class="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between"
                >
                    <div class="min-w-0">
                        <p class="font-semibold text-gray-900 truncate">
                            {{ res.display_name }}
                        </p>
                        <p class="text-gray-500 font-mono truncate" :title="res.address">
                            {{ res.address }}
                        </p>
                    </div>
                    <span class="text-[10px] uppercase tracking-wider bg-white px-2 py-0.5 rounded border border-gray-300 text-gray-600 ml-2 shrink-0">
                        {{ res.category }}
                    </span>
                </li>
            </ul>
        </section>

        <!-- Security Groups (read-only) -->
        <section v-if="securityResources.length > 0">
            <div class="flex items-center gap-2 mb-3">
                <Shield :size="14" class="text-gray-400" />
                <h3 class="text-sm font-bold uppercase tracking-wider text-gray-600">
                    Sicherheit
                </h3>
                <span class="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-bold rounded">
                    {{ securityResources.length }}
                </span>
            </div>
            <ul class="space-y-1.5 text-xs">
                <li
                    v-for="res in securityResources"
                    :key="res.address"
                    class="px-3 py-2 bg-gray-50 rounded-lg border border-gray-100"
                >
                    <p class="font-semibold text-gray-900">{{ res.display_name }}</p>
                    <p class="text-gray-500 font-mono">{{ res.address }}</p>
                </li>
            </ul>
        </section>
    </div>
</template>
