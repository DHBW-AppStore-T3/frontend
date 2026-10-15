<script setup lang="ts">
/**
 * The Infrastructure panel of a pod deployment: one row per workload (a
 * team's or a person's pod), read live from the cluster.
 *
 * Restart replaces the pod and keeps its data; reset also deletes the
 * workload's volume, so the parent asks before it emits ``reset``. Both are
 * offered only with the operate right and while the API allows a redeploy.
 *
 * Owner view only — the parent decides that; the backend gates the
 * underlying endpoint the same way.
 */
import { Boxes, RefreshCw, AlertCircle, RotateCcw, Eraser, ExternalLink } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import type { PodWorkload } from '@/types'

defineProps<{
    workloads: PodWorkload[]
    loading: boolean
    error: string | null
    /** False when the cluster could not be asked (the list is then empty). */
    live: boolean
    /** Restart/reset buttons: operate right and redeploy allowed right now. */
    canAct: boolean
    /** Workloads with a restart or reset in flight. */
    busy: Set<string>
}>()

defineEmits<{
    (e: 'refresh'): void
    (e: 'restart', workload: string): void
    (e: 'reset', workload: string): void
}>()

const { t } = useI18n()

const phaseClass = (w: PodWorkload): string => {
    if (w.ready) return 'bg-green-100 text-green-800 border-green-300'
    if (w.phase === 'Stopped') return 'bg-slate-100 text-slate-700 border-slate-300'
    if (['Pending', 'ContainerCreating', 'PodInitializing'].includes(w.phase)) {
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    }
    return 'bg-red-100 text-red-800 border-red-300'
}

const phaseLabel = (w: PodWorkload): string => {
    const key = `pods.phase.${w.phase}`
    const translated = t(key)
    return translated === key ? w.phase : translated
}
</script>

<template>
    <div class="bg-white rounded-xl border border-borderSubtle p-6 shadow-sm mb-8" data-testid="pod-workloads">
        <div class="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div class="flex items-center gap-3">
                <div class="p-2 bg-surfaceMuted rounded-lg">
                    <Boxes :size="20" class="text-textMuted" />
                </div>
                <span class="text-lg font-semibold text-textHeading">{{ t('pods.title') }}</span>
                <span class="px-2 py-0.5 bg-surfaceMuted text-textMuted text-xs font-bold rounded">{{ workloads.length }}</span>
            </div>
            <button
                @click="$emit('refresh')"
                :disabled="loading"
                class="text-xs font-semibold px-3 py-1.5 rounded-lg border border-borderSubtle hover:bg-surfaceMuted disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
                :title="t('pods.refreshTooltip')"
            >
                <RefreshCw :size="13" :class="loading ? 'animate-spin' : ''" />
                {{ t('pods.refresh') }}
            </button>
        </div>

        <div v-if="error" class="flex items-start gap-2 text-sm text-danger bg-dangerTint border border-danger/30 rounded-lg p-3 mb-4">
            <AlertCircle :size="16" class="mt-0.5 flex-shrink-0" />
            <span>{{ error }}</span>
        </div>
        <p v-else-if="!live && !loading" class="text-sm text-textMuted">{{ t('pods.notLive') }}</p>
        <p v-else-if="workloads.length === 0 && !loading" class="text-sm text-textMuted">{{ t('pods.none') }}</p>

        <div v-if="workloads.length > 0" class="overflow-x-auto">
            <table class="w-full text-sm">
                <thead>
                    <tr class="border-b border-borderSubtle text-left text-xs text-textMuted uppercase tracking-wide">
                        <th class="pb-2 pr-4">{{ t('pods.workload') }}</th>
                        <th class="pb-2 pr-4">{{ t('pods.team') }}</th>
                        <th class="pb-2 pr-4">{{ t('pods.state') }}</th>
                        <th class="pb-2 pr-4">{{ t('pods.restarts') }}</th>
                        <th class="pb-2 pr-4">{{ t('pods.lastEvent') }}</th>
                        <th v-if="canAct" class="pb-2">{{ t('pods.actions') }}</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-borderSubtle">
                    <tr v-for="w in workloads" :key="w.workload" :data-testid="`workload-${w.workload}`">
                        <td class="py-2.5 pr-4 font-mono text-textHeading">
                            <a v-if="w.url" :href="w.url" target="_blank" rel="noopener noreferrer"
                               class="inline-flex items-center gap-1 text-info hover:underline">
                                {{ w.workload }} <ExternalLink :size="12" />
                            </a>
                            <span v-else>{{ w.workload }}</span>
                        </td>
                        <td class="py-2.5 pr-4 text-textMuted">{{ w.team || '–' }}</td>
                        <td class="py-2.5 pr-4">
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border" :class="phaseClass(w)">
                                {{ phaseLabel(w) }}
                            </span>
                        </td>
                        <td class="py-2.5 pr-4 tabular-nums" :class="w.restarts > 0 ? 'text-warning font-semibold' : 'text-textMuted'">
                            {{ w.restarts }}
                        </td>
                        <td class="py-2.5 pr-4 text-xs text-textMuted max-w-[320px] truncate" :title="w.lastEvent ?? ''">
                            {{ w.lastEvent || '–' }}
                        </td>
                        <td v-if="canAct" class="py-2.5">
                            <div class="flex items-center gap-2">
                                <button
                                    type="button"
                                    :disabled="busy.has(w.workload)"
                                    class="text-xs px-2 py-1 rounded border border-borderSubtle hover:bg-surfaceMuted inline-flex items-center gap-1 disabled:opacity-50"
                                    :title="t('pods.restartTooltip')"
                                    :data-testid="`restart-${w.workload}`"
                                    @click="$emit('restart', w.workload)"
                                >
                                    <RotateCcw :size="12" /> {{ t('pods.restart') }}
                                </button>
                                <button
                                    type="button"
                                    :disabled="busy.has(w.workload)"
                                    class="text-xs px-2 py-1 rounded border border-danger/30 text-danger hover:bg-dangerTint inline-flex items-center gap-1 disabled:opacity-50"
                                    :title="t('pods.resetTooltip')"
                                    :data-testid="`reset-${w.workload}`"
                                    @click="$emit('reset', w.workload)"
                                >
                                    <Eraser :size="12" /> {{ t('pods.reset') }}
                                </button>
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
