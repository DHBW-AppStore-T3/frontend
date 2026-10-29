import type { AppVariable, DeploymentFile } from '@/types'
import { effectiveScope, userSlotKey, type WizardTeam } from './variableForm'

export interface Recipient {
  /** The slot key of the form (``draft.fileUploads[variable][id]``). */
  id: string
  name: string
  /** Team rows: the members underneath. */
  sub?: string
}

/** ``all``: one file for the whole deployment, ``person``: rows are people, ``team``: rows are teams. */
export type RecipientKind = 'all' | 'person' | 'team'

type NameOf = (userId: string) => string

/** The same file: name, size and content (what "one file for everybody" means). */
export const sameFile = (a: DeploymentFile | null, b: DeploymentFile | null): boolean =>
  !!a && !!b && a.name === b.name && a.size === b.size && a.content_b64 === b.content_b64

/** The name of a person as in the earlier steps; the username when nothing better is known. */
function personName(member: WizardTeam['members'][number], nameOf: NameOf): string {
  const name = nameOf(member.userId)
  return name && name !== member.userId ? name : member.username
}

/**
 * Who can get a file of this variable: the slots of the form, named for people. An app that runs per
 * person makes every person a team of one, so that shows the person and not "Team #2".
 */
export function buildRecipients(
  variable: AppVariable,
  teams: WizardTeam[],
  nameOf: NameOf,
): { kind: RecipientKind; rows: Recipient[] } {
  const scope = effectiveScope(variable)
  if (scope === 'all') return { kind: 'all', rows: [{ id: 'all', name: '' }] }

  if (scope === 'user') {
    return {
      kind: 'person',
      rows: teams.flatMap((team) =>
        team.members.map((member) => ({
          id: userSlotKey(team.name, member.username),
          name: personName(member, nameOf),
          ...(team.members.length > 1 ? { sub: team.name } : {}),
        })),
      ),
    }
  }

  if (teams.length > 0 && teams.every((team) => team.members.length === 1)) {
    return {
      kind: 'person',
      rows: teams.map((team) => ({ id: team.name, name: personName(team.members[0]!, nameOf) })),
    }
  }
  return {
    kind: 'team',
    rows: teams.map((team) => ({
      id: team.name,
      name: team.name,
      ...(team.members.length > 0 ? { sub: team.members.map((m) => personName(m, nameOf)).join(', ') } : {}),
    })),
  }
}
