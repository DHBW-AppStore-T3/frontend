import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Users } from 'lucide-react'
import RecipientRail, { type RailItem } from './RecipientRail'
import { CardBadge, EditButton } from './SummaryCard'
import type { EnvironmentUnit } from './summaryRows'

export interface ParticipantTeam {
  id: string
  name: string
  members: string[]
}

type Mode = 'one' | 'eachUser' | 'custom'

interface Props {
  mode: Mode
  /** What one team gets: a pod environment or a Windows desktop. */
  unit: EnvironmentUnit
  people: number
  teams: ParticipantTeam[]
  onEdit: () => void
}

/** "Teilnehmende": the mode in a chip, what it means in a sentence, and who is in it as one rail. */
export default function SummaryParticipants({ mode, unit, people, teams, onEdit }: Props) {
  const { t } = useTranslation()
  const titleId = useId()
  const title = t('deployment.summary.participants.title')

  let sentence = t(`deployment.summary.participants.${mode}.${unit}`)
  if (mode === 'custom') {
    sentence += ` ${t('deployment.summary.participants.customTotal', {
      environments: t(`deployment.summary.counts.${unit === 'desktop' ? 'desktops' : 'pods'}`, { count: teams.length }),
      people: t('deployment.summary.counts.persons', { count: people }),
    })}`
  }

  // Everybody has an environment of their own: the people are the rows, a team of one says nothing more.
  const items: RailItem[] =
    mode === 'eachUser'
      ? teams.flatMap((team) => team.members.map((member) => ({ id: `${team.id}/${member}`, name: member, filled: true })))
      : teams.map((team) => ({
          id: team.id,
          name: team.name,
          sub: team.members.length > 0 ? team.members.join(', ') : t('deployment.summary.noUsersAssigned'),
          filled: true,
          right: (
            <span className="rail-row__right text-right text-sm tabular-nums text-textStrong">
              {t('deployment.summary.counts.persons', { count: team.members.length })}
            </span>
          ),
        }))

  return (
    <section className="summary-card summary-who" aria-labelledby={titleId} data-testid="summary-participants">
      <div className="summary-who__top">
        <CardBadge>
          <Users size={20} />
        </CardBadge>
        <h2 id={titleId} className="summary-who__title">
          {title} <span className="summary-chip">{t(`deployment.groups.${mode}`)}</span>
        </h2>
        <EditButton label={t('deployment.summary.edit.teams')} onClick={onEdit} />
        <p className="summary-who__sub">{sentence}</p>
      </div>
      <div className="summary-who__rail">
        <RecipientRail items={items} aria-label={title} />
      </div>
    </section>
  )
}
