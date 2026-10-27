import { networkPayload } from '@/utils/network'
import type { DeploymentCreate, DeploymentDraft, DeploymentFile } from '@/types'

/** Thrown when the draft has no app or no name; ``submitDraft`` checks this before building. */
export const DRAFT_REQUIRED_ERROR = 'App und Name sind Pflichtfelder'

type Team = NonNullable<DeploymentCreate['teams']>[number]

/**
 * The version to deploy. The release tag may come as a string or as an object
 * (``{ version }`` / ``{ name }``) from the UI; anything else, and an empty
 * or blank string, means ``latest``. A string is passed on as it is (not trimmed).
 */
export function normalizeReleaseTag(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const tag = raw as { version?: unknown; name?: unknown }
    // Passed on as it is, whatever type ``version``/``name`` have.
    return (tag.version || tag.name || 'latest') as string
  }
  if (typeof raw === 'string' && raw.trim() !== '') return raw
  return 'latest'
}

/**
 * Prepare the current draft as a DeploymentCreate payload.
 * - Normalizes ``releaseTag``
 * - Packs wizard selections (courses, groups, variables) into ``userInputVar``
 */
export function buildDeploymentPayload(draft: DeploymentDraft): DeploymentCreate {
  if (!draft.appId || !draft.name) {
    throw new Error(DRAFT_REQUIRED_ERROR)
  }

  const finalVersion = normalizeReleaseTag(draft.releaseTag)

  // Teams: Array<{ name: string, userIds: string[] }>
  let draftTeams: Array<{ name: string; userIds: unknown[] }> = []
  if (Array.isArray(draft.groupNames) && Array.isArray(draft.assignments)) {
    // assignments: one array of user IDs per group index; groupNames: string[]
    const assignments: unknown[] = draft.assignments
    draftTeams = draft.groupNames.map((name: string, idx: number) => {
      const members = assignments[idx]
      return { name, userIds: Array.isArray(members) ? (members as unknown[]) : [] }
    })
  }

  // Fallback: if no teams are defined, auto-create teams based on studentIds.
  if (draftTeams.length === 0 && draft.studentIds.length > 0) {
    // Create teams based on groupCount.
    const groupCount = draft.groupCount
    const studentsPerGroup = Math.floor(draft.studentIds.length / groupCount)
    const remainder = draft.studentIds.length % groupCount

    draftTeams = []
    let currentIndex = 0
    for (let i = 0; i < groupCount; i++) {
      const groupSize = studentsPerGroup + (i < remainder ? 1 : 0)
      const groupStudents = draft.studentIds.slice(currentIndex, currentIndex + groupSize)
      draftTeams.push({
        name: draft.groupNames[i] || `Team-${i + 1}`,
        userIds: groupStudents,
      })
      currentIndex += groupSize
    }
  }

  // Ensure all userIds are formatted as UUID strings.
  const teams: Team[] = draftTeams.map((team) => ({
    name: team.name,
    userIds: team.userIds.map((id) => (typeof id === 'string' ? id : String(id))),
  }))

  // userInputVar: { terraform: {...} } (the key is historical: the app's own variables)
  const terraform: Record<string, unknown> = {}
  const userInputVar: Record<string, unknown> = { terraform }
  if (draft.variables && typeof draft.variables === 'object') {
    if (Array.isArray(draft.variableDefinitions)) {
      for (const def of draft.variableDefinitions) {
        // File-typed variables travel through ``files`` instead of
        // ``userInputVar``. Skipping them here keeps the variables
        // dict free of accidental ``undefined`` entries that would
        // confuse the backend's terraform encoder.
        if (def.osType === 'file') continue
        const val: unknown = draft.variables[def.name]
        // Skip empty / undefined values — they would otherwise be
        // forwarded to Terraform as ``-var=name=null`` and bypass
        // the variable's HCL ``default = ...``. Critical for any
        // variable whose default is structurally non-trivial
        // (e.g. ``map(object(...))``) — the user not touching it
        // must mean "use the default", not "set to null". An
        // empty string is also treated as "no input".
        if (val === undefined || val === null) continue
        if (typeof val === 'string' && val.trim() === '') continue
        // Scoped variables (``varScope = team|user``) arrive as a
        // map. An empty map means no slot was filled — same logic
        // applies: ship nothing so the HCL default wins.
        if (
          typeof val === 'object'
          && !Array.isArray(val)
          && (def.varScope === 'team' || def.varScope === 'user')
          && Object.keys(val).length === 0
        ) {
          continue
        }
        terraform[def.name] = val
      }
    } else {
      // Fallback: alles in terraform
      userInputVar.terraform = { ...draft.variables }
    }
  }

  // Drop empty file-variable entries — the wizard may have rendered
  // a slot that the user never filled (optional file with default
  // ``{}``). Sending it would still hit the backend's ``file_var_empty``
  // guard with a confusing error.
  const fileUploads: Record<string, Record<string, DeploymentFile>> = {}
  if (draft.fileUploads) {
    for (const [varName, slotMap] of Object.entries(draft.fileUploads)) {
      const filledSlots: Record<string, DeploymentFile> = {}
      for (const [slotKey, file] of Object.entries(slotMap || {})) {
        if (file && file.content_b64) {
          filledSlots[slotKey] = file
        }
      }
      if (Object.keys(filledSlots).length > 0) {
        fileUploads[varName] = filledSlots
      }
    }
  }

  // cpu/memory the person chose for the containers the app lets them size.
  if (draft.resources && Object.keys(draft.resources).length > 0) {
    userInputVar.resources = draft.resources
  }
  // Internet / networked pods: only what the app allows, and pod networking
  // only with two or more workloads (otherwise there is nobody to reach).
  const network = networkPayload(draft)
  if (network) userInputVar.network = network

  const payload: DeploymentCreate = {
    name: draft.name,
    appId: draft.appId,
    releaseTag: finalVersion,
    userInputVar,
    teams,
  }
  if (Object.keys(fileUploads).length > 0) {
    payload.files = fileUploads
  }
  return payload
}
