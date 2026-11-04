import { describe, it, expect, vi } from 'vitest'
import { cleanup, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SummaryParticipants, { type ParticipantTeam } from '../SummaryParticipants'
import { renderWithProviders } from '../../../../tests/helpers/render'

const PEOPLE = ['Studentin Drei', 'Student Zwei', 'Student Vier']
const EACH: ParticipantTeam[] = PEOPLE.map((p, i) => ({ id: `t${i}`, name: `Team #${i + 1}`, members: [p] }))
const ONE: ParticipantTeam[] = [{ id: 't0', name: 'Einzelteam', members: PEOPLE }]
const CUSTOM: ParticipantTeam[] = [
  { id: 't0', name: 'Team Alpha', members: PEOPLE.slice(0, 2) },
  { id: 't1', name: 'Team Beta', members: PEOPLE.slice(2) },
]

function setup(over: Partial<React.ComponentProps<typeof SummaryParticipants>> = {}) {
  const onEdit = vi.fn()
  renderWithProviders(
    <SummaryParticipants mode="eachUser" unit="pod" people={3} teams={EACH} onEdit={onEdit} {...over} />,
    { realI18n: true },
  )
  return { onEdit }
}

describe('SummaryParticipants', () => {
  it('is a region "Teilnehmende" with the name of the mode as a chip', () => {
    setup()
    expect(screen.getByRole('region', { name: /Teilnehmende/ })).toBeInTheDocument()
    expect(screen.getByText('Jeder Nutzer einzeln')).toBeInTheDocument()
  })

  it.each([
    ['eachUser', 'pod', EACH, 'Jede Person bekommt eine eigene Umgebung.'],
    ['eachUser', 'desktop', EACH, 'Jede Person bekommt einen eigenen Windows-Desktop.'],
    ['one', 'pod', ONE, 'Alle arbeiten gemeinsam in einer Umgebung.'],
    ['one', 'desktop', ONE, 'Alle arbeiten gemeinsam in einem Windows-Desktop.'],
    ['custom', 'pod', CUSTOM, 'Jedes Team bekommt eine eigene Umgebung. Das sind 2 Umgebungen für 3 Personen.'],
    ['custom', 'desktop', CUSTOM, 'Jedes Team bekommt einen eigenen Windows-Desktop. Das sind 2 Desktops für 3 Personen.'],
  ] as const)('explains mode %s for %s in a sentence', (mode, unit, teams, sentence) => {
    setup({ mode, unit, teams: [...teams] })
    expect(screen.getByText(sentence)).toBeInTheDocument()
  })

  it.each([
    ['one', ONE, 'Jede Person bekommt eine eigene Umgebung; die Teams bestimmen, wer welche Dateien bekommt.'],
    [
      'custom',
      CUSTOM,
      'Jede Person bekommt eine eigene Umgebung; die Teams bestimmen, wer welche Dateien bekommt. Das sind 3 Umgebungen für 3 Personen.',
    ],
  ] as const)('says that in mode %s everybody still has an environment of their own', (mode, teams, sentence) => {
    setup({ mode, unit: 'pod', teams: [...teams], environment: 'user' })
    expect(screen.getByText(sentence)).toBeInTheDocument()
  })

  it.each([
    ['user', 'Eine Umgebung je Person'],
    ['team', 'Eine Umgebung je Team'],
  ] as const)('names the environments chosen for groups in a second chip (%s)', (environment, chip) => {
    setup({ mode: 'custom', teams: CUSTOM, environment })
    expect(screen.getByTestId('summary-environment')).toHaveTextContent(chip)
  })

  it('has no second chip where there was nothing to choose, or everybody is on their own anyway', () => {
    setup({ mode: 'custom', teams: CUSTOM })
    expect(screen.queryByTestId('summary-environment')).not.toBeInTheDocument()
    cleanup()
    setup({ mode: 'eachUser', environment: 'user' })
    expect(screen.queryByTestId('summary-environment')).not.toBeInTheDocument()
    expect(screen.getByText('Jede Person bekommt eine eigene Umgebung.')).toBeInTheDocument()
  })

  it('counts one environment and one person in the singular', () => {
    setup({ mode: 'custom', unit: 'pod', people: 1, teams: [{ id: 't0', name: 'Team Alpha', members: ['Studentin Drei'] }] })
    expect(screen.getByText(/Das sind 1 Umgebung für 1 Person\./)).toBeInTheDocument()
  })

  it('lists only the people when everybody gets an environment of their own', () => {
    setup()
    const rows = within(screen.getByRole('list', { name: 'Teilnehmende' })).getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(PEOPLE)
    expect(screen.queryByText('Team #1')).not.toBeInTheDocument()
  })

  it('lists teams with their members underneath and how many people they have', () => {
    setup({ mode: 'custom', teams: CUSTOM })
    const rows = within(screen.getByRole('list', { name: 'Teilnehmende' })).getAllByRole('listitem')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toHaveTextContent('Team Alpha')
    expect(rows[0]).toHaveTextContent('Studentin Drei, Student Zwei')
    expect(rows[0]).toHaveTextContent('2 Personen')
    expect(rows[1]).toHaveTextContent('1 Person')
    expect(rows[1]).not.toHaveTextContent('1 Personen')
  })

  it('says so when a team has nobody', () => {
    setup({ mode: 'custom', teams: [{ id: 't0', name: 'Team Alpha', members: [] }] })
    expect(screen.getByText('Keine User zugewiesen')).toBeInTheDocument()
  })

  it('leads to the distribution from "Bearbeiten", which says where it leads', async () => {
    const { onEdit } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Verteilung bearbeiten' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
