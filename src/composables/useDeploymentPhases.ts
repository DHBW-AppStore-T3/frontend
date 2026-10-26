/**
 * Phase-stepper state for a deployment's live progress UI.
 *
 * Extracted from DeploymentDetailView, which had grown to ~2590 lines and
 * carried this alongside resource loading, VM drawer state, the delete and
 * pause/resume flows, SSE wiring, JSON highlighting and clipboard helpers.
 *
 * The worker owns the phase contract: it emits `phase_names` on every progress
 * event. The static tables below mirror the worker's pod-task phase lists
 * (`PHASES_*` in worker `app/pod_tasks.py`) and are only a pre-first-event
 * fallback so the stepper renders at the right width instead of collapsing.
 */

import { useMemo } from 'react'

import type { Task } from '@/types'

/**
 * Dot count used before the worker reports its real phase total, so the
 * stepper does not visibly resize on the first progress event.
 */
export const DEFAULT_PHASE_COUNT = 7

export interface DeploymentPhaseSources {
    /** Live phase total from the worker; 0 before the first event. */
    streamTotalPhases: number
    /** Authoritative phase-name list from the worker, once it has arrived. */
    streamPhaseNames: string[] | null
    /** 1-based index of the active phase, or null pre-first-event. */
    streamCurrentPhaseIndex: number | null
    /** Percent complete 0..100, or null pre-first-event. */
    streamProgress: number | null
    /** The task the stepper is describing. */
    activeTask: Task | null
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
    const activeType = activeTask?.type

    return useMemo(
        () => derivePhases({
            streamTotalPhases,
            streamPhaseNames,
            streamCurrentPhaseIndex,
            streamProgress,
            activeTask: activeType ? ({ type: activeType } as Task) : null,
        }),
        [streamTotalPhases, streamPhaseNames, streamCurrentPhaseIndex, streamProgress, activeType],
    )
}

function derivePhases(sources: DeploymentPhaseSources) {
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
    // Default to a conservative 5-dot view before the first event arrives so the
    // layout doesn't jump when the worker reports its real phase count.


    const PHASE_LABELS_DEPLOY = [
        'STARTING',
        'SPEC_LOAD',
        'K8S_NAMESPACE',
        'K8S_POLICIES',
        'K8S_APPLY',
        'K8S_WAIT_READY',
        'OUTPUTS_AND_CLEANUP',
    ] as const

    const PHASE_LABELS_DESTROY = [
        'STARTING',
        'K8S_DELETE',
        'K8S_WAIT_GONE',
        'CLEANUP',
    ] as const

    const PHASE_LABELS_PAUSE = [
        'STARTING',
        'K8S_SCALE_DOWN',
        'K8S_WAIT_STOPPED',
    ] as const

    const PHASE_LABELS_RESUME = [
        'STARTING',
        'K8S_SCALE_UP',
        'K8S_WAIT_READY',
    ] as const

    const PHASE_LABELS_REDEPLOY = [
        'STARTING',
        'K8S_RESTART',
        'K8S_WAIT_READY',
    ] as const

    // Stepper labels: the worker sends the full phase sequence as ``phase_names``
    // with every progress event — the authoritative source.
    // Before the first progress event, we fall back to the static tables below.

    const phaseStepCount: number =
        streamTotalPhases > 0 ? streamTotalPhases : DEFAULT_PHASE_COUNT

    // Return the label for a given 0-based index. Order of precedence:
    //   1. ``streamPhaseNames`` — authoritative, ships from the worker on
    //      every progress event for every real task.
    //   2. Static table picked by ``activeTask.type`` — used in the brief
    //      window between page-load and the first progress event.
    //   3. Numeric slot index — empty-slot guard so the stepper height
    //      doesn't collapse during the loading flicker.
    const phaseStepLabel = (idx: number): string => {
        // 1. Worker-authoritative list.
        const fromStream = streamPhaseNames
        if (Array.isArray(fromStream) && idx >= 0 && idx < fromStream.length) {
            return phaseLabel(fromStream[idx])
        }

        // 2. Static fallback by active task type. Used until the first
        //    progress event lands.
        let table: readonly string[] | null = null
        const activeType = activeTask?.type
        if (activeType === 'pause') {
            table = PHASE_LABELS_PAUSE
        } else if (activeType === 'resume') {
            table = PHASE_LABELS_RESUME
        } else if (activeType === 'redeploy') {
            table = PHASE_LABELS_REDEPLOY
        } else if (activeType === 'destroy') {
            table = PHASE_LABELS_DESTROY
        } else if (activeType === 'deploy') {
            table = PHASE_LABELS_DEPLOY
        }
        // Length-based last resort (no active task type known yet).
        if (!table) {
            if (streamTotalPhases === PHASE_LABELS_DEPLOY.length) table = PHASE_LABELS_DEPLOY
            else if (streamTotalPhases === PHASE_LABELS_DESTROY.length) table = PHASE_LABELS_DESTROY
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
    const currentPhaseIndex: number = (() => {
        if (streamCurrentPhaseIndex !== null && streamCurrentPhaseIndex > 0) {
            return streamCurrentPhaseIndex - 1
        }
        if (streamProgress === null) return -1
        const total = phaseStepCount
        const pct = Math.max(0, Math.min(100, streamProgress))
        return Math.max(0, Math.min(total - 1, Math.round((pct / 100) * total) - 1))
    })()

    const phaseLabel = (phase: unknown): string => {
        if (typeof phase !== 'string' || !phase) return ''
        return phase
            .split('_')
            .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
            .join(' ')
    }

    return { phaseStepCount, phaseStepLabel, currentPhaseIndex, phaseLabel }
}
