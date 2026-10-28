import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app.store'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToast } from '@/composables/useToast'
import { paths } from '@/router/paths'
import type { AppVariable, SlotValue, VariableValue } from '@/types'
import {
  buildDraftValues,
  buildWizardTeams,
  dedupeVariables,
  dropStaleSlots,
  findMissingRequired,
  hasBlockingExpert,
  initialFromFetch,
  isSlotMap,
  parseStoredInput,
  restoreFromDraft,
  type FormValues,
} from './variableForm'
import { versionLabelOf } from './summary'

/**
 * State and actions of the wizard's variables step: definitions, form values,
 * team-derived slots, required-gating and persistence into the draft.
 */
export function useVariableForm() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()

  const draft = useDeploymentStore((s) => s.draft)
  const studentCache = useDeploymentStore((s) => s.studentCache)

  const [variables, setVariables] = useState<AppVariable[]>(
    () => useDeploymentStore.getState().draft.variableDefinitions ?? [],
  )
  const [rawFormValues, setFormValues] = useState<FormValues>({})
  const [isLoading, setIsLoading] = useState(
    () => !(useDeploymentStore.getState().draft.variableDefinitions?.length),
  )
  const [terraformExpertOpen, setTerraformExpertOpen] = useState(false)

  // ------------------------------------------------------------- derived
  const teams = useMemo(
    () => buildWizardTeams(draft.groupNames, draft.assignments as string[][], studentCache),
    [draft.groupNames, draft.assignments, studentCache],
  )
  const terraformVariables = useMemo(() => variables.filter((v) => v.source === 'terraform'), [variables])
  // ---------------------------------------------------------- initial load
  useEffect(() => {
    const store = useDeploymentStore.getState()
    const appId = store.draft.appId
    if (!appId) {
      navigate(paths.apps, { replace: true })
      return
    }

    let cancelled = false
    const currentTeams = () => {
      const d = useDeploymentStore.getState()
      return buildWizardTeams(d.draft.groupNames, d.draft.assignments as string[][], d.studentCache)
    }
    const openBlockingExperts = (defs: AppVariable[]) => {
      if (hasBlockingExpert(defs)) setTerraformExpertOpen(true)
    }

    void (async () => {
      const cached = store.draft.variableDefinitions
      if (cached && cached.length > 0) {
        setFormValues(restoreFromDraft(cached, store.draft.variables || {}, currentTeams()))
        openBlockingExperts(cached)
        return
      }

      let defs: AppVariable[]
      try {
        const raw = await useAppStore.getState().fetchAppVariables(appId, versionLabelOf(store.draft.releaseTag))
        if (cancelled) return
        defs = dedupeVariables(raw)
        useDeploymentStore.getState().updateDraft({ variableDefinitions: defs })
        setVariables(defs)

        const saved = parseStoredInput(useDeploymentStore.getState().draft.userInputVar, () =>
          toast.error(t('deployment.summary.invalidJson')),
        )
        setFormValues(initialFromFetch(defs, saved, currentTeams()))
        openBlockingExperts(defs)
      } catch (error) {
        console.error(error)
        if (!cancelled) toast.error(t('deployment.summary.fetchVarsError'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // Entry load, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----------------------------------------- team rename reconciliation
  // When teams change while this step is open, slot values of vanished teams
  // are ignored (and the user is told). Derived rather than written back, so
  // restoring previously saved slots on entry is left untouched.
  const teamsKey = JSON.stringify(teams)
  const [initialTeamsKey] = useState(teamsKey)
  const teamsChanged = teamsKey !== initialTeamsKey
  const reconciled = useMemo(
    () =>
      teamsChanged && variables.length > 0
        ? dropStaleSlots(variables, rawFormValues, teams)
        : { values: rawFormValues, dropped: [] as string[] },
    [teamsChanged, variables, rawFormValues, teams],
  )
  const formValues = reconciled.values
  const droppedKey = reconciled.dropped.join('\n')

  useEffect(() => {
    if (!droppedKey) return
    toast.info(
      t('deployment.variables.teamRenameToast', { count: droppedKey.split('\n').length, lines: droppedKey }),
    )
    // Notify once per distinct set of dropped slots.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedKey])

  const missingRequired = useMemo(
    () => findMissingRequired(variables, formValues, teams),
    [variables, formValues, teams],
  )

  // --------------------------------------------------------------- actions
  const setValue = useCallback((key: string, value: SlotValue) => setFormValues((f) => ({ ...f, [key]: value })), [])

  const setScopedValue = useCallback(
    (key: string, slot: string, value: SlotValue) =>
      setFormValues((f) => {
        const bag = f[key]
        const map = isSlotMap(bag) ? bag : {}
        return { ...f, [key]: { ...map, [slot]: value } }
      }),
    [],
  )

  const getScopedValue = (key: string, slot: string): VariableValue => {
    const bag = formValues[key]
    return isSlotMap(bag) ? (bag[slot] ?? '') : ''
  }

  /** Several slots of one file variable in a single store update (``null`` removes a slot). */
  const setFileSlots = (varName: string, updates: Record<string, import('@/types').DeploymentFile | null>) => {
    const uploads = useDeploymentStore.getState().draft.fileUploads ?? {}
    const bag = { ...(uploads[varName] ?? {}) }
    for (const [slot, file] of Object.entries(updates)) {
      if (file === null) delete bag[slot]
      else bag[slot] = file
    }
    useDeploymentStore.getState().updateDraft({ fileUploads: { ...uploads, [varName]: bag } })
  }

  const getFileSlot = (varName: string, slot: string) => draft.fileUploads?.[varName]?.[slot] ?? null

  const next = () => {
    try {
      const { changed, all } = buildDraftValues(variables, formValues)
      useDeploymentStore.getState().updateDraft({
        userInputVar: JSON.stringify(changed),
        variables: all,
      })
      navigate(paths.deploymentSummary)
    } catch (e) {
      console.error(e)
      toast.error(t('deployment.variables.saveError'))
    }
  }

  return {
    draftName: draft.name,
    isLoading,
    variables,
    teams,
    terraformVariables,
    formValues,
    missingRequired,
    canSubmit: missingRequired.length === 0,
    terraformExpertOpen,
    setTerraformExpertOpen,
    setValue,
    setScopedValue,
    getScopedValue,
    getFileSlot,
    setFileSlots,
    next,
    back: () => navigate(paths.deploymentTeams),
  }
}
