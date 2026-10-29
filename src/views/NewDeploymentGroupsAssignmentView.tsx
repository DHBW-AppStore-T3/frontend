import { useEffect, useRef, useState, useEffectEvent } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Minus,
  Users,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  Trash2,
  Shuffle,
  AlertTriangle,
} from 'lucide-react'
import DeploymentProgressBar from '@/components/DeploymentProgressBar'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useDeploymentConstraints } from '@/composables/useDeploymentConstraints'
import { paths } from '@/router/paths'
import TeamColumn from './new-deployment/TeamColumn'
import UnassignedPool from './new-deployment/UnassignedPool'
import { useStudentNames } from './new-deployment/useStudentNames'
import { ensureVariableDefinitions, resolveNeedsVariablesStep } from './new-deployment/variableDefinitions'
import { useNeedsVariablesStep } from './new-deployment/variablesStep'
import {
  chooseCustom,
  chooseEachUser,
  chooseOneGroup,
  clearAssignments,
  isAssignmentComplete,
  moveStudent,
  normalizeTeams,
  removeFromTeam,
  resizeTeams,
  shuffleIntoTeams,
  unassignedOf,
  type GroupMode,
  type TeamsState,
} from './new-deployment/teamAssignment'

const MODE_BUTTON_BASE = 'px-5 py-2.5 rounded-xl font-semibold transition-all text-sm border-2'
const MODE_ACTIVE = 'bg-primary text-white border-primaryDark shadow-none'
const MODE_IDLE = 'bg-white text-textMuted border-borderSubtle hover:border-primary/30 hover:bg-primaryFaint'
const MODE_LOCKED = 'bg-surfaceMuted text-textMuted border-borderSubtle cursor-not-allowed opacity-50'

export default function NewDeploymentGroupsAssignmentView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const draft = useDeploymentStore((s) => s.draft)
  const draftApp = useDeploymentStore((s) => s.draftAppDetails)()
  const { forcedGroupMode, groupModeReason, groupModeTitle } = useDeploymentConstraints(draftApp, { runtime: draft.runtime, scope: draft.scope })

  const isForced = forcedGroupMode === 'eachUser'
  const needsVariables = useNeedsVariablesStep()

  const [dragged, setDragged] = useState<string | null>(null)
  const [dragOverTeam, setDragOverTeam] = useState<number | null>(null)
  const [dragOverPool, setDragOverPool] = useState(false)

  const studentIds = draft.studentIds
  const teams: TeamsState = {
    mode: draft.groupMode as GroupMode,
    count: draft.groupCount,
    assignments: draft.assignments,
    names: draft.groupNames,
  }
  const unassigned = unassignedOf(studentIds, teams.assignments)
  const nameOf = useStudentNames([...new Set([...studentIds, ...teams.assignments.flat()])])
  const translate = (key: string, options: { index: number }) => t(key, options)

  const apply = (next: TeamsState) =>
    useDeploymentStore.getState().updateDraft({
      groupMode: next.mode,
      groupCount: next.count,
      assignments: next.assignments,
      groupNames: next.names,
    })

  // Guard + normalisation on entry (and the Windows constraint).
  const initialised = useRef(false)
  const normaliseOnEntry = useEffectEvent(() => {
    if (initialised.current) return
    initialised.current = true
    const current = useDeploymentStore.getState().draft
    if (!current.studentIds || current.studentIds.length === 0) {
      navigate(paths.deploymentConfig, { replace: true })
      return
    }
    const normalised = normalizeTeams(
      {
        mode: current.groupMode as GroupMode,
        count: current.groupCount,
        assignments: current.assignments,
        names: current.groupNames,
      },
      translate,
    )
    apply(forcedGroupMode === 'eachUser' ? chooseEachUser(current.studentIds, translate) : normalised)
  })

  // Entry effect: runs once; the guard reads the draft at that moment.
  useEffect(() => normaliseOnEntry(), [])

  // The variables step is left out for apps with nothing to set. Step 1 already asked the backend;
  // this repeats it for deep links and after a failure there (one request at a time, see the helper).
  useEffect(() => {
    ensureVariableDefinitions().catch(() => {})
  }, [])

  // "Weiter" waits for the answer if it is still open, so that the step is not skipped on a guess.
  const [isDeciding, setIsDeciding] = useState(false)
  const deciding = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const goNext = async () => {
    if (deciding.current) return
    deciding.current = true
    setIsDeciding(true)
    const needed = await resolveNeedsVariablesStep()
    deciding.current = false
    if (!mounted.current) return
    setIsDeciding(false)
    navigate(needed === false ? paths.deploymentSummary : paths.deploymentVariables)
  }

  const increment = () => {
    if (teams.count < studentIds.length) apply(resizeTeams(teams, teams.count + 1, translate))
  }
  const decrement = () => {
    if (teams.count > 1) apply(resizeTeams(teams, teams.count - 1, translate))
  }

  const startDrag = (studentId: string, event: React.DragEvent) => {
    setDragged(studentId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', studentId)
  }
  const endDrag = () => {
    setDragged(null)
    setDragOverTeam(null)
    setDragOverPool(false)
  }
  const dropOn = (target: number | null) => (event: React.DragEvent) => {
    event.preventDefault()
    if (dragged && !isForced) apply({ ...teams, assignments: moveStudent(teams.assignments, dragged, target) })
    setDragOverTeam(null)
    setDragOverPool(false)
  }

  const modeButton = (mode: GroupMode, label: string, onClick: () => void, lockedByConstraint: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={lockedByConstraint}
      className={`${MODE_BUTTON_BASE} ${
        teams.mode === mode ? MODE_ACTIVE : lockedByConstraint ? MODE_LOCKED : MODE_IDLE
      }`}
    >
      {label}
    </button>
  )

  const visibleTeams = teams.assignments.slice(0, teams.count)

  return (
    <div className="app-page wizard-page">
      <div className="wizard-surface flex flex-col">
        {/* Header */}
        <div className="p-8 pb-6 bg-white border-b-2 border-borderSubtle">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primaryDark flex items-center justify-center shadow-lg">
              <Users size={28} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold text-textHeading">{t('deployment.title')}</h1>
          </div>
          <DeploymentProgressBar currentStep={2} showVariablesStep={needsVariables !== false} />
        </div>

        {/* Controls */}
        <div className="p-6 bg-white border-b-2 border-borderSubtle">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-2">
              {modeButton(
                'one',
                t('deployment.groups.one'),
                () => apply(chooseOneGroup(teams, studentIds, translate)),
                forcedGroupMode !== null,
              )}
              {modeButton(
                'eachUser',
                t('deployment.groups.eachUser'),
                () => apply(chooseEachUser(studentIds, translate)),
                false,
              )}
              {modeButton(
                'custom',
                t('deployment.groups.custom'),
                () => apply(chooseCustom(teams, studentIds.length, translate)),
                forcedGroupMode !== null,
              )}
            </div>

            {teams.mode === 'custom' ? (
              <div className="flex items-center gap-3 bg-surfaceMuted px-4 py-2 rounded-xl border-2 border-borderSubtle">
                <button
                  type="button"
                  onClick={decrement}
                  disabled={teams.count <= 1}
                  aria-label="decrement"
                  className="w-9 h-9 rounded-lg bg-white border border-borderSubtle hover:border-red-400 hover:bg-dangerTint flex items-center justify-center transition-all text-danger disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Minus size={18} />
                </button>
                <div className="flex items-center gap-2">
                  <span className="text-3xl font-bold text-textHeading w-12 text-center tabular-nums">
                    {teams.count}
                  </span>
                  <span className="text-sm font-semibold text-textMuted">{t('deployment.assignment.teamsLabel')}</span>
                </div>
                <button
                  type="button"
                  onClick={increment}
                  disabled={teams.count >= studentIds.length}
                  aria-label="increment"
                  className="w-9 h-9 rounded-lg bg-white border border-borderSubtle hover:border-primary hover:bg-primaryFaint flex items-center justify-center transition-all text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus size={18} />
                </button>
              </div>
            ) : null}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  apply({
                    ...teams,
                    assignments: shuffleIntoTeams(studentIds, teams.count, Math.random),
                  })
                }
                disabled={isForced}
                className="px-4 py-2.5 rounded-xl bg-purple-100 text-purple-700 font-semibold hover:bg-purple-200 transition-all flex items-center gap-2 border-2 border-purple-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-100"
                title={t('deployment.assignment.shuffleTooltip')}
              >
                <Shuffle size={18} />
                {t('deployment.assignment.shuffle')}
              </button>
              <button
                type="button"
                onClick={() => apply({ ...teams, assignments: clearAssignments(teams.count) })}
                disabled={isForced}
                className="px-4 py-2.5 rounded-xl bg-dangerTint text-red-700 font-semibold hover:bg-red-200 transition-all flex items-center gap-2 border-2 border-danger/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-dangerTint"
                title={t('deployment.assignment.resetTooltip')}
              >
                <Trash2 size={18} />
                {t('deployment.assignment.reset')}
              </button>
            </div>
          </div>

          {!isForced ? (
            <div className="mt-4 bg-infoTint border-2 border-info/30 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-info flex items-center justify-center flex-shrink-0 mt-0.5">
                <GripVertical size={16} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-blue-900 mb-1">{t('deployment.assignment.dragDropTitle')}</p>
                <p className="text-sm text-blue-700">{t('deployment.assignment.dragDropText')}</p>
              </div>
            </div>
          ) : null}

          {forcedGroupMode !== null ? (
            <div className="mt-3 bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={16} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 mb-1">{groupModeTitle ? t(groupModeTitle) : ''}</p>
                <p className="text-sm text-amber-800">{groupModeReason ? t(groupModeReason) : ''}</p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Main grid */}
        <div className="flex-grow p-6 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            <div className="lg:col-span-1">
              <UnassignedPool
                studentIds={unassigned}
                nameOf={nameOf}
                isDragOver={dragOverPool}
                dragDisabled={isForced}
                onDragStart={startDrag}
                onDragEnd={endDrag}
                onDragEnter={() => setDragOverPool(true)}
                onDragLeave={() => setDragOverPool(false)}
                onDrop={dropOn(null)}
              />
            </div>

            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 h-full overflow-y-auto pr-2">
                {visibleTeams.map((studentsOfTeam, index) => (
                  <TeamColumn
                    key={index}
                    index={index}
                    name={teams.names[index] ?? ''}
                    studentIds={studentsOfTeam ?? []}
                    nameOf={nameOf}
                    isDragOver={dragOverTeam === index}
                    dragDisabled={isForced}
                    onRename={(name) =>
                      apply({ ...teams, names: teams.names.map((n, i) => (i === index ? name : n)) })
                    }
                    onDragStart={startDrag}
                    onDragEnd={endDrag}
                    onDragEnter={() => setDragOverTeam(index)}
                    onDragLeave={() => setDragOverTeam(null)}
                    onDrop={dropOn(index)}
                    onRemove={(studentId) =>
                      apply({ ...teams, assignments: removeFromTeam(teams.assignments, studentId, index) })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 pt-4 bg-white border-t-2 border-borderSubtle">
          <button
            type="button"
            onClick={() => navigate(paths.deploymentConfig)}
            data-testid="btn-back"
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-surfaceMuted text-textMuted font-bold hover:bg-gray-200 transition-all shadow-md"
          >
            <ArrowLeft size={20} />
            {t('deployment.actions.back')}
          </button>

          <div className="text-center">
            <p className="text-sm text-textMuted mb-1">{t('deployment.assignment.progress')}</p>
            <p className="text-lg font-bold text-primary">
              {t('deployment.assignment.assignedCount', {
                assigned: studentIds.length - unassigned.length,
                total: studentIds.length,
              })}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void goNext()}
            data-testid="btn-next"
            aria-busy={isDeciding}
            disabled={!isAssignmentComplete(studentIds, teams) || isDeciding}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primaryDark text-white font-bold hover:from-primaryDark hover:to-primaryDark transition-all shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('deployment.actions.next')}
            {isDeciding ? (
              <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <ArrowRight size={20} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
