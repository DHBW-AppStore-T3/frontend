/**
 * Phase-stepper state for a deployment's live progress UI.
 *
 * Extracted from DeploymentDetailView.vue, which had grown to ~2590 lines and
 * carried this alongside resource loading, VM drawer state, the delete and
 * pause/resume flows, SSE wiring, JSON highlighting and clipboard helpers.
 *
 * The worker owns the phase contract: it emits `phase_names` on every progress
 * event, including the `:<template_key>` suffixes that multi-image builds use.
 * The static tables below are only a pre-first-event fallback so the stepper
 * renders at the right width instead of collapsing, and they are matched by
 * length rather than assumed.
 */

import { computed, type Ref } from 'vue'

import type { Task } from '@/types'

/**
 * Dot count used before the worker reports its real phase total, so the
 * stepper does not visibly resize on the first progress event.
 */
export const DEFAULT_PHASE_COUNT = 11

export interface DeploymentPhaseSources {
    /** Live phase total from the worker; 0 before the first event. */
    streamTotalPhases: Ref<number>
    /** Authoritative phase-name list from the worker, once it has arrived. */
    streamPhaseNames: Ref<string[] | null>
    /** 1-based index of the active phase, or null pre-first-event. */
    streamCurrentPhaseIndex: Ref<number | null>
    /** Percent complete 0..100, or null pre-first-event. */
    streamProgress: Ref<number | null>
    /** The task the stepper is describing. */
    activeTask: Ref<Task | null>
}

/**
 * Returns the stepper's width, a label resolver for each dot, and which dot is
 * currently active.
 */
export function useDeploymentPhases(sources: DeploymentPhaseSources) {
    const {
        streamTotalPhases,
        streamPhaseNames,
        streamCurrentPhaseIndex,
        streamProgress,
        activeTask,
    } = sources


    // Phase stepper — N dots based on the live ``totalPhases`` reported by the
    // worker. Phase names live in the worker (different sets for deploy/destroy),
    // so the frontend stays task-type-agnostic for the dot count. Label tables for
    // the deploy/destroy presets render meaningful labels under each dot when the
    // totals match a known shape; an unknown count falls back to numbered labels.
    //
    // Default to a conservative 11-dot view before the first event arrives so the
    // layout doesn't jump when the worker reports its real phase count.


    const PHASE_LABELS_DEPLOY_FULL = [
        'STARTING',
        'OPENSTACK_SETUP',
        'GIT_CLONE',
        'CREDS_MATERIALISE',
        'PACKER_INIT',
        'PACKER_VALIDATE',
        'PACKER_BUILD',
        'TERRAFORM_INIT',
        'TERRAFORM_PLAN',
        'TERRAFORM_APPLY',
        'OUTPUTS_AND_CLEANUP',
    ] as const

    const PHASE_LABELS_DEPLOY_NO_PACKER = [
        'STARTING',
        'OPENSTACK_SETUP',
        'GIT_CLONE',
        'CREDS_MATERIALISE',
        'TERRAFORM_INIT',
        'TERRAFORM_PLAN',
        'TERRAFORM_APPLY',
        'OUTPUTS_AND_CLEANUP',
    ] as const

    const PHASE_LABELS_DESTROY = [
        'STARTING',
        'OPENSTACK_SETUP',
        'GIT_CLONE',
        'CREDS_MATERIALISE',
        'TERRAFORM_INIT',
        'TERRAFORM_DESTROY',
        'CLEANUP',
    ] as const

    // Pause/Resume share the destroy preamble (clone + clouds + tf init to allow a
    // state-pull) but their hot phase is a CLI-driven server stop/start, not a
    // terraform destroy. Same length as ``PHASE_LABELS_DESTROY`` (7), so tables are
    // picked by task type first and only fall back to length-matching when the type
    // is unknown (e.g. live-stream attached before tasks were loaded).
    const PHASE_LABELS_PAUSE = [
        'STARTING',
        'OPENSTACK_SETUP',
        'GIT_CLONE',
        'CREDS_MATERIALISE',
        'TERRAFORM_INIT',
        'SERVER_STOP',
        'CLEANUP',
    ] as const

    const PHASE_LABELS_RESUME = [
        'STARTING',
        'OPENSTACK_SETUP',
        'GIT_CLONE',
        'CREDS_MATERIALISE',
        'TERRAFORM_INIT',
        'SERVER_START',
        'CLEANUP',
    ] as const

    // Per-VM redeploy reuses the destroy preamble (clone, clouds.yaml,
    // init) and then runs ``terraform apply -replace=… -target=…`` for
    // the single targeted resource. Phase shape mirrors
    // ``worker/app/tasks.py:_PHASES_REDEPLOY``.
    const PHASE_LABELS_REDEPLOY = [
        'STARTING',
        'OPENSTACK_SETUP',
        'GIT_CLONE',
        'CREDS_MATERIALISE',
        'TERRAFORM_INIT',
        'TERRAFORM_APPLY',
        'CLEANUP',
    ] as const

    // Stepper labels: the worker sends the full phase sequence as ``phase_names``
    // with every progress event — the authoritative source, since multi-image
    // deploys have a dynamic sequence whose template keys the frontend can't guess.
    // Before the first progress event, we fall back to the static tables below,
    // which cover the fixed shapes (single-image deploy / destroy / pause / resume
    // / redeploy); multi-image slots show generic numbers until ``phase_names`` lands.

    const phaseStepCount = computed<number>(() => {
        return streamTotalPhases.value > 0 ? streamTotalPhases.value : DEFAULT_PHASE_COUNT
    })

    // Return the label for a given 0-based index. Order of precedence:
    //   1. ``streamPhaseNames`` — authoritative, ships from the worker on
    //      every progress event for every real task (deploy / destroy /
    //      pause / resume / redeploy). Contains the exact phase names
    //      including ``:<template_key>`` suffixes for multi-image builds.
    //   2. Static table picked by ``activeTask.type`` — used in the brief
    //      window between page-load and the first progress event, and
    //      always for legacy Single-Image-Deploy where the worker's
    //      sequence is byte-identical to ``PHASE_LABELS_DEPLOY_FULL``.
    //   3. Numeric slot index — empty-slot guard so the stepper height
    //      doesn't collapse during the loading flicker.
    const phaseStepLabel = (idx: number): string => {
        // 1. Worker-authoritative list.
        const fromStream = streamPhaseNames.value
        if (Array.isArray(fromStream) && idx >= 0 && idx < fromStream.length) {
            return phaseLabel(fromStream[idx])
        }

        // 2. Static fallback by active task type. Used until the first
        //    progress event lands.
        let table: readonly string[] | null = null
        const activeType = activeTask.value?.type
        if (activeType === 'pause') {
            table = PHASE_LABELS_PAUSE
        } else if (activeType === 'resume') {
            table = PHASE_LABELS_RESUME
        } else if (activeType === 'destroy') {
            table = PHASE_LABELS_DESTROY
        } else if (activeType === 'redeploy') {
            table = PHASE_LABELS_REDEPLOY
        } else if (activeType === 'deploy') {
            // Without the worker's ``phase_names`` we can't tell legacy
            // (11) apart from multi-image (14, 17, ...). The total is
            // already known from the stream though, so pick the matching
            // table when it fits exactly — otherwise leave ``table = null``
            // and let the loop fall through to numeric slot indices.
            // Once the first progress event arrives, ``phase_names`` takes
            // over and the predicted slots are replaced with real labels.
            if (streamTotalPhases.value === PHASE_LABELS_DEPLOY_NO_PACKER.length) {
                table = PHASE_LABELS_DEPLOY_NO_PACKER
            } else if (streamTotalPhases.value === PHASE_LABELS_DEPLOY_FULL.length) {
                table = PHASE_LABELS_DEPLOY_FULL
            }
        }
        // Length-based last resort (no active task type known yet).
        if (!table) {
            const total = streamTotalPhases.value
            if (total === PHASE_LABELS_DEPLOY_FULL.length) table = PHASE_LABELS_DEPLOY_FULL
            else if (total === PHASE_LABELS_DEPLOY_NO_PACKER.length) table = PHASE_LABELS_DEPLOY_NO_PACKER
            else if (total === PHASE_LABELS_DESTROY.length) table = PHASE_LABELS_DESTROY
        }
        if (table && idx >= 0 && idx < table.length) {
            return phaseLabel(table[idx])
        }
        // 3. Numeric placeholder so the slot has a non-empty label.
        return String(idx + 1)
    }

    // 0-based index of the active dot. Prefer the worker's authoritative
    // ``phase_index`` (1-based) from the SSE payload — only fall back to
    // rounding ``progress_pct`` if no progress event has arrived yet.
    const currentPhaseIndex = computed<number>(() => {
        if (streamCurrentPhaseIndex.value !== null && streamCurrentPhaseIndex.value > 0) {
            return streamCurrentPhaseIndex.value - 1
        }
        if (streamProgress.value === null) return -1
        const total = phaseStepCount.value
        const pct = Math.max(0, Math.min(100, streamProgress.value))
        return Math.max(0, Math.min(total - 1, Math.round((pct / 100) * total) - 1))
    })

    const phaseLabel = (phase: unknown): string => {
        if (typeof phase !== 'string' || !phase) return ''
        // Worker-emitted multi-image phases carry the template key as a ``:<key>``
        // suffix (e.g. ``PACKER_BUILD:database``). Split the suffix off, title-case
        // the base name, and append the sub-key as ``[<key>]`` so the stepper reads
        // ``Packer Build [database]`` instead of ``Packer Build:database``.
        const colonIdx = phase.indexOf(':')
        const base = colonIdx === -1 ? phase : phase.slice(0, colonIdx)
        const subKey = colonIdx === -1 ? '' : phase.slice(colonIdx + 1).trim()
        const formattedBase = base
            .split('_')
            .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
            .join(' ')
        return subKey ? `${formattedBase} [${subKey}]` : formattedBase
    }

    return { phaseStepCount, phaseStepLabel, currentPhaseIndex, phaseLabel }
}
