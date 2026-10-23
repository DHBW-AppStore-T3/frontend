import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/api/user.api', () => ({ userApi: { getById: vi.fn() } }))

import { userApi } from '@/api/user.api'
import NewDeploymentGroupsAssignmentView from '@/views/NewDeploymentGroupsAssignmentView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderView = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/deployment/new/teams" element={<NewDeploymentGroupsAssignmentView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/deployment/new/teams' },
  )

const draft = () => useDeploymentStore.getState().draft

function seed(over: Record<string, unknown> = {}) {
  useDeploymentStore.getState().resetDraft()
  useDeploymentStore.getState().updateDraft({
    studentIds: ['u1', 'u2'],
    groupCount: 2,
    groupNames: ['Team 1', 'Team 2'],
    assignments: [[], []],
    groupMode: 'custom',
    ...over,
  } as any)
}

beforeEach(() => {
  vi.clearAllMocks()
  const cache = useDeploymentStore.getState().studentCache
  cache.clear()
  cache.set('u1', { userId: 'u1', firstName: 'John', lastName: 'Doe' } as any)
  cache.set('u2', { userId: 'u2', firstName: 'Jane', lastName: 'Smith' } as any)
  useAppStore.setState({ apps: [] })
  vi.mocked(userApi.getById).mockResolvedValue({ data: { userId: 'u3', firstName: 'Missing', lastName: 'User' } } as any)
  seed()
})

describe('NewDeploymentGroupsAssignmentView', () => {
  it('leitet zur Konfiguration um, wenn keine Studierenden gewählt sind', async () => {
    seed({ studentIds: [] })
    renderView()

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/config'))
  })

  it('zeigt nicht zugewiesene Studierende und sperrt "Weiter"', async () => {
    renderView()

    expect(await screen.findByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    expect(screen.getByTestId('btn-next')).toBeDisabled()
  })

  it('weist in "Eine Gruppe" alle einem Team zu', async () => {
    renderView()
    await screen.findByText('John Doe')

    await userEvent.click(screen.getByRole('button', { name: 'deployment.groups.one' }))

    expect(draft().groupMode).toBe('one')
    expect(draft().groupCount).toBe(1)
    expect(draft().assignments[0]).toEqual(['u1', 'u2'])
  })

  it('legt in "Jeder einzeln" ein Team pro Studierendem an', async () => {
    renderView()
    await screen.findByText('John Doe')

    await userEvent.click(screen.getByRole('button', { name: 'deployment.groups.eachUser' }))

    expect(draft().groupMode).toBe('eachUser')
    expect(draft().groupCount).toBe(2)
    expect(draft().assignments).toEqual([['u1'], ['u2']])
  })

  it('erhöht und verringert die Teamanzahl im Custom-Modus (max. Anzahl Studierender)', async () => {
    seed({ studentIds: ['u1', 'u2', 'u3'] })
    renderView()
    await screen.findByText('John Doe')

    await userEvent.click(screen.getByLabelText('increment'))
    expect(draft().groupCount).toBe(3)
    expect(screen.getByLabelText('increment')).toBeDisabled()

    await userEvent.click(screen.getByLabelText('decrement'))
    expect(draft().groupCount).toBe(2)
  })

  it('verschiebt einen Studierenden per Drag & Drop in ein Team und zurück', async () => {
    renderView()
    const chip = (await screen.findByText('John Doe')).closest('[draggable]') as HTMLElement
    const teamZones = [...document.querySelectorAll<HTMLElement>('.min-h-\\[200px\\]')]

    fireEvent.dragStart(chip, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    fireEvent.drop(teamZones[0]!, { dataTransfer: { dropEffect: '' } })

    expect(draft().assignments[0]).toEqual(['u1'])

    const assigned = screen.getAllByText('John Doe')[0]!.closest('[draggable]') as HTMLElement
    fireEvent.dragStart(assigned, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } })
    const pool = screen.getByText('deployment.assignment.unassigned').closest('.flex-col')!.querySelector('.overflow-y-auto')!
    fireEvent.drop(pool, { dataTransfer: { dropEffect: '' } })

    expect(draft().assignments[0]).toEqual([])
  })

  it('entfernt einen Studierenden per X-Button aus dem Team', async () => {
    seed({ assignments: [['u1', 'u2'], []] })
    renderView()
    const removeButtons = await screen.findAllByTestId('btn-remove-student')

    await userEvent.click(removeButtons[0]!)

    expect(draft().assignments[0]).toEqual(['u2'])
  })

  it('verteilt per "Mischen" alle Studierenden', async () => {
    renderView()
    await screen.findByText('John Doe')

    await userEvent.click(screen.getByRole('button', { name: /deployment\.assignment\.shuffle$/ }))

    expect((draft().assignments as string[][]).flat().sort()).toEqual(['u1', 'u2'])
  })

  it('setzt per "Zurücksetzen" alle Zuweisungen zurück', async () => {
    seed({ assignments: [['u1'], ['u2']] })
    renderView()
    await screen.findByText('John Doe')

    await userEvent.click(screen.getByRole('button', { name: /deployment\.assignment\.reset$/ }))

    expect(draft().assignments).toEqual([[], []])
  })

  it('aktiviert "Weiter" erst, wenn alle zugewiesen sind und navigiert zu den Variablen', async () => {
    renderView()
    await screen.findByText('John Doe')
    expect(screen.getByTestId('btn-next')).toBeDisabled()

    useDeploymentStore.getState().updateDraft({ assignments: [['u1'], ['u2']] })

    await waitFor(() => expect(screen.getByTestId('btn-next')).toBeEnabled())
    await userEvent.click(screen.getByTestId('btn-next'))
    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/variables')
  })

  it('füllt leere Teamnamen beim Betreten mit Standardnamen', async () => {
    seed({ assignments: [['u1'], ['u2']], groupNames: ['A', ' '] })
    renderView()
    await screen.findByText('John Doe')

    expect(draft().groupNames).toEqual(['A', 'deployment.assignment.vmDefaultName'])
    expect(screen.getByTestId('btn-next')).toBeEnabled()
  })

  it('sperrt "Weiter", wenn ein Teamname geleert wird', async () => {
    seed({ assignments: [['u1'], ['u2']], groupNames: ['A', 'B'] })
    renderView()
    await screen.findByText('John Doe')

    await userEvent.clear(screen.getAllByRole('textbox')[1]!)

    expect(screen.getByTestId('btn-next')).toBeDisabled()
  })

  it('benennt ein Team um', async () => {
    renderView()
    await screen.findByText('John Doe')

    const input = screen.getAllByRole('textbox')[0]!
    await userEvent.clear(input)
    await userEvent.type(input, 'Rot')

    expect(draft().groupNames[0]).toBe('Rot')
  })

  it('lädt fehlende Namen nach', async () => {
    seed({ studentIds: ['u1', 'u3'] })
    renderView()

    expect(await screen.findByText('Missing User')).toBeInTheDocument()
    expect(userApi.getById).toHaveBeenCalledWith('u3')
  })

  it('geht über "Zurück" zur Konfiguration', async () => {
    renderView()
    await screen.findByText('John Doe')

    await userEvent.click(screen.getByTestId('btn-back'))

    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/config')
  })

  it('erzwingt für Windows-Apps "Jeder einzeln" und sperrt die anderen Modi', async () => {
    useAppStore.setState({ apps: [{ appId: 'win', name: 'Windows Server' } as any] })
    seed({ appId: 'win' })
    renderView()

    await waitFor(() => expect(draft().groupMode).toBe('eachUser'))
    expect(screen.getByRole('button', { name: 'deployment.groups.one' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'deployment.groups.custom' })).toBeDisabled()
    expect(screen.getByText('deployment.assignment.windowsConstraintTitle')).toBeInTheDocument()
  })

  describe('nach Laufzeit und Scope der Version (appstore.yaml)', () => {
    it('scope user erzwingt "Jeder einzeln", auch bei einer Pod-App ohne Windows im Namen', async () => {
      useAppStore.setState({ apps: [{ appId: 'lab', name: 'Ubuntu Lab' } as any] })
      seed({ appId: 'lab', runtime: 'kubernetes', scope: 'user' })
      renderView()

      await waitFor(() => expect(draft().groupMode).toBe('eachUser'))
      expect(screen.getByText('deployment.assignment.perPersonConstraintText')).toBeInTheDocument()
    })

    it('scope team lässt die Gruppierung frei, auch bei einem "Windows"-Namen', async () => {
      useAppStore.setState({ apps: [{ appId: 'win', name: 'Windows Lab' } as any] })
      seed({ appId: 'win', runtime: 'openstack-vm', scope: 'team' })
      renderView()

      await screen.findByText('John Doe')
      expect(screen.getByRole('button', { name: 'deployment.groups.one' })).toBeEnabled()
      expect(screen.queryByText('deployment.assignment.windowsConstraintTitle')).not.toBeInTheDocument()
    })
  })
})
