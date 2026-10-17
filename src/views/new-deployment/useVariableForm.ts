import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/app.store'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToast } from '@/composables/useToast'
import { ensureLoaded } from '@/composables/useOpenStackResourceCache'
import type { OsResourceType } from '@/api/openstack-resources.api'
import { paths } from '@/router/paths'
import type { AppVariable } from '@/types'
import {
  buildDraftValues,
  buildWizardTeams,
  dedupeVariables,
  dropStaleSlots,
  findMissingRequired,
  formKeyOf,
  groupPackerByTemplate,
  hasBlockingExpert,
  initialFromFetch,
  isMultiImageLayout,
  markerErrorLines,
  restoreFromDraft,
  type FormValues,
} from './variableForm'
import { versionLabelOf } from './summary'

function parseSavedInput(raw: unknown, onInvalid: () => void): Record<string, any> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, any>
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      return JSON.parse(raw)
    } catch (e) {
      console.warn('Invalid JSON in userInputVar', e)
      onInvalid()
    }
  }
  return {}
}

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
  const [packerExpertOpen, setPackerExpertOpen] = useState(false)
  const [terraformExpertOpen, setTerraformExpertOpen] = useState(false)

  // ------------------------------------------------------------- derived
  const teams = useMemo(
    () => buildWizardTeams(draft.groupNames, draft.assignments as string[][], studentCache),
    [draft.groupNames, draft.assignments, studentCache],
  )
  const packerByTemplate = useMemo(() => groupPackerByTemplate(variables), [variables])
  const templateKeys = useMemo(() => Object.keys(packerByTemplate).sort(), [packerByTemplate])
  const isMultiImage = isMultiImageLayout(templateKeys)
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
      if (hasBlockingExpert(defs)) {
        setPackerExpertOpen(true)
        setTerraformExpertOpen(true)
      }
    }

    void (async () => {
      const cached = store.draft.variableDefinitions
      if (cached && cached.length > 0) {
        const multi = isMultiImageLayout(Object.keys(groupPackerByTemplate(cached)))
        setFormValues(restoreFromDraft(cached, (store.draft.variables || {}) as Record<string, any>, multi, currentTeams()))
        openBlockingExperts(cached)
        return
      }

      let defs: AppVariable[] = []
      try {
        const raw = await useAppStore.getState().fetchAppVariables(appId, versionLabelOf(store.draft.releaseTag))
        if (cancelled) return
        defs = dedupeVariables(raw)
        useDeploymentStore.getState().updateDraft({ variableDefinitions: defs })
        setVariables(defs)

        // Prime the display cache so pickers/summary show names right away.
        const types = new Set<string>()
        defs.forEach((v) => v.osType && v.osType !== 'file' && types.add(v.osType))
        await Promise.allSettled([...types].map((type) => ensureLoaded(type as OsResourceType)))
        if (cancelled) return

        const saved = parseSavedInput(useDeploymentStore.getState().draft.userInputVar, () =>
          toast.error(t('deployment.summary.invalidJson')),
        )
        const multi = isMultiImageLayout(Object.keys(groupPackerByTemplate(defs)))
        setFormValues(initialFromFetch(defs, saved, multi, currentTeams()))
        openBlockingExperts(defs)
      } catch (error) {
        console.error(error)
        if (!cancelled) toast.error(t('deployment.summary.fetchVarsError'))
      } finally {
        if (!cancelled) setIsLoading(false)
      }

      const lines = markerErrorLines(defs)
      if (!cancelled && lines.length > 0) {
        toast.error(t('deployment.variables.markerErrorToast', { count: lines.length, lines: lines.join('\n') }))
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
        ? dropStaleSlots(variables, rawFormValues, isMultiImage, teams)
        : { values: rawFormValues, dropped: [] as string[] },
    [teamsChanged, variables, rawFormValues, isMultiImage, teams],
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
    () => findMissingRequired(variables, formValues, isMultiImage, teams),
    [variables, formValues, isMultiImage, teams],
  )

  // --------------------------------------------------------------- actions
  const setValue = useCallback((key: string, value: any) => setFormValues((f) => ({ ...f, [key]: value })), [])

  const setScopedValue = useCallback(
    (key: string, slot: string, value: any) =>
      setFormValues((f) => {
        const bag = f[key]
        const map = bag && typeof bag === 'object' && !Array.isArray(bag) ? bag : {}
        return { ...f, [key]: { ...map, [slot]: value } }
      }),
    [],
  )

  const getScopedValue = (key: string, slot: string): any => {
    const bag = formValues[key]
    return bag && typeof bag === 'object' && !Array.isArray(bag) ? (bag[slot] ?? '') : ''
  }

  /** Id-mode value of the first network picker, used to filter subnet pickers. */
  const networkIdForSubnets = (): string | null => {
    const networkVar = variables.find((v) => v.osType === 'network' && v.osMode === 'id')
    if (!networkVar) return null
    const val = formValues[formKeyOf(networkVar, isMultiImage)]
    return typeof val === 'string' && val.trim() ? val : null
  }

  const setFileSlot = (varName: string, slot: string, file: import('@/types').DeploymentFile | null) => {
    const uploads = useDeploymentStore.getState().draft.fileUploads ?? {}
    const bag = { ...(uploads[varName] ?? {}) }
    if (file === null) delete bag[slot]
    else bag[slot] = file
    useDeploymentStore.getState().updateDraft({ fileUploads: { ...uploads, [varName]: bag } })
  }

  const getFileSlot = (varName: string, slot: string) => draft.fileUploads?.[varName]?.[slot] ?? null

  const next = () => {
    try {
      const { changed, all } = buildDraftValues(variables, formValues, isMultiImage)
      useDeploymentStore.getState().updateDraft({
        userInputVar: JSON.stringify(changed) as any,
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
    templateKeys,
    packerByTemplate,
    terraformVariables,
    isMultiImage,
    formValues,
    missingRequired,
    canSubmit: missingRequired.length === 0,
    packerExpertOpen,
    setPackerExpertOpen,
    terraformExpertOpen,
    setTerraformExpertOpen,
    setValue,
    setScopedValue,
    getScopedValue,
    getFileSlot,
    setFileSlot,
    networkIdForSubnets,
    next,
    back: () => navigate(paths.deploymentTeams),
  }
}
