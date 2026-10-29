import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

import NewDeploymentVariableView from '@/views/NewDeploymentVariableView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { buildDeploymentPayload } from '@/utils/deployment-payload'
import { renderWithProviders } from '../../helpers/render'

// A slot is the value (or file) of one team or one person of a team-/user-scoped variable. The step
// saved them while the teams looked one way; step 1 (deselecting people) and step 2 (renaming,
// deleting, moving) can change the teams afterwards. What the teams no longer contain must not be
// saved on "Weiter" in step 3, and so not be sent: the backend answers a team that does not exist
// with 422 ``unknown_scope_target`` and takes a person's slot of an existing team unchecked.

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderStep = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/deployment/new/variables" element={<NewDeploymentVariableView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/deployment/new/variables' },
  )

const draft = () => useDeploymentStore.getState().draft
const upload = (name: string) => ({ name, size: 1, content_b64: 'eA==', content_type: 'text/plain' })
const variable = (over: Record<string, unknown>) => ({ type: 'string', source: 'terraform', ...over })

const definitions = [
  variable({ name: 'size', varScope: 'user' }),
  variable({ name: 'flavor', varScope: 'team' }),
  variable({ name: 'motd' }),
  variable({ name: 'starter', osType: 'file', osScope: 'user', varScope: 'user' }),
  variable({ name: 'handout', osType: 'file', osScope: 'team', varScope: 'team' }),
  variable({ name: 'syllabus', osType: 'file', osScope: 'all', varScope: 'all' }),
]

/** What step 3 saved while the teams were Alpha (ann, bob) and Beta (cy). */
const savedVariables = () => ({
  size: { 'Alpha-ann': 'S', 'Alpha-bob': 'L', 'Beta-cy': 'M' },
  flavor: { Alpha: 'a', Beta: 'b' },
  motd: 'hi',
})
const savedFiles = () => ({
  starter: { 'Alpha-ann': upload('ann.txt'), 'Alpha-bob': upload('bob.txt'), 'Beta-cy': upload('cy.txt') },
  handout: { Alpha: upload('alpha.txt'), Beta: upload('beta.txt') },
  syllabus: { all: upload('all.txt') },
})

/** The draft after the earlier steps changed the teams: step 3 is entered again with the saved values. */
function seedTeams(groupNames: string[], assignments: string[][]) {
  const store = useDeploymentStore.getState()
  store.resetDraft()
  store.studentCache.clear()
  store.studentCache.set('u1', { username: 'ann' } as never)
  store.studentCache.set('u2', { username: 'bob' } as never)
  store.studentCache.set('u3', { username: 'cy' } as never)
  store.updateDraft({
    appId: 'app-1',
    name: 'Lab',
    releaseTag: '1.0.0',
    studentIds: assignments.flat(),
    groupNames,
    assignments,
    variableDefinitions: definitions as never,
    variables: savedVariables() as never,
    fileUploads: savedFiles(),
  })
}

/** Enter the step with the saved values and press "Weiter". */
async function leaveStep() {
  renderStep()
  await screen.findAllByTestId('file-variable-card')
  await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.next/ }))
  await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/summary'))
}

const savedInput = () => JSON.parse(draft().userInputVar as string)

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ fetchAppVariables: vi.fn().mockResolvedValue([]) } as never)
})

describe('"Weiter" in the variables step drops the slots of teams and people that are gone', () => {
  it('a person deselected in step 1: their slots and the slots of the team they left alone are gone', async () => {
    // bob and cy are no longer selected; only ann is left, in Alpha.
    seedTeams(['Alpha'], [['u1']])
    await leaveStep()

    expect(draft().variables).toEqual({
      size: { 'Alpha-ann': 'S' },
      flavor: { Alpha: 'a' },
      motd: 'hi',
    })
    expect(draft().fileUploads).toEqual({
      starter: { 'Alpha-ann': upload('ann.txt') },
      handout: { Alpha: upload('alpha.txt') },
      syllabus: { all: upload('all.txt') },
    })
    expect(savedInput()).toEqual({ size: { 'Alpha-ann': 'S' }, flavor: { Alpha: 'a' }, motd: 'hi' })
  })

  it('the deployment sent carries only the slots of the teams that exist', async () => {
    seedTeams(['Alpha'], [['u1']])
    await leaveStep()

    const payload = buildDeploymentPayload(draft())

    expect(payload.userInputVar).toEqual({
      terraform: { size: { 'Alpha-ann': 'S' }, flavor: { Alpha: 'a' }, motd: 'hi' },
    })
    expect(payload.files).toEqual({
      starter: { 'Alpha-ann': upload('ann.txt') },
      handout: { Alpha: upload('alpha.txt') },
      syllabus: { all: upload('all.txt') },
    })
  })

  it('a team renamed in step 2: the slots of the old name are gone, the others stay', async () => {
    seedTeams(['Alfa', 'Beta'], [['u1', 'u2'], ['u3']])
    await leaveStep()

    expect(draft().variables).toEqual({ size: { 'Beta-cy': 'M' }, flavor: { Beta: 'b' }, motd: 'hi' })
    expect(draft().fileUploads).toEqual({
      starter: { 'Beta-cy': upload('cy.txt') },
      handout: { Beta: upload('beta.txt') },
      syllabus: { all: upload('all.txt') },
    })
  })

  it('a team deleted in step 2: its slots are gone', async () => {
    seedTeams(['Alpha'], [['u1', 'u2', 'u3']])
    await leaveStep()

    expect(draft().variables).toEqual({
      size: { 'Alpha-ann': 'S', 'Alpha-bob': 'L' },
      flavor: { Alpha: 'a' },
      motd: 'hi',
    })
    expect(draft().fileUploads).toEqual({
      starter: { 'Alpha-ann': upload('ann.txt'), 'Alpha-bob': upload('bob.txt') },
      handout: { Alpha: upload('alpha.txt') },
      syllabus: { all: upload('all.txt') },
    })
  })

  it('a person moved to another team: the slot in the old team is gone, the new one starts empty', async () => {
    seedTeams(['Alpha', 'Beta'], [['u1'], ['u3', 'u2']])
    await leaveStep()

    expect(draft().variables).toEqual({
      size: { 'Alpha-ann': 'S', 'Beta-cy': 'M' },
      flavor: { Alpha: 'a', Beta: 'b' },
      motd: 'hi',
    })
    expect(draft().fileUploads?.starter).toEqual({ 'Alpha-ann': upload('ann.txt'), 'Beta-cy': upload('cy.txt') })
  })

  it('every team replaced: nothing of the old slots is sent, and no empty file entry either', async () => {
    seedTeams(['Neu'], [['u1']])
    await leaveStep()

    const payload = buildDeploymentPayload(draft())

    expect(draft().variables).toEqual({ size: {}, flavor: {}, motd: 'hi' })
    expect(draft().fileUploads).toEqual({ starter: {}, handout: {}, syllabus: { all: upload('all.txt') } })
    expect(payload.userInputVar).toEqual({ terraform: { motd: 'hi' } })
    expect(payload.files).toEqual({ syllabus: { all: upload('all.txt') } })
  })

  it('nothing is lost when the teams are as they were', async () => {
    seedTeams(['Alpha', 'Beta'], [['u1', 'u2'], ['u3']])
    await leaveStep()

    expect(draft().variables).toEqual(savedVariables())
    expect(draft().fileUploads).toEqual(savedFiles())
  })

  it('keeps what was typed in the step for the people that are still there', async () => {
    seedTeams(['Alpha'], [['u1']])
    renderStep()
    await screen.findAllByTestId('file-variable-card')

    fireEvent.change(document.getElementById('size__Alpha-ann')!, { target: { value: 'XL' } })
    await userEvent.click(screen.getByRole('button', { name: /deployment\.actions\.next/ }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/summary'))

    expect(draft().variables.size).toEqual({ 'Alpha-ann': 'XL' })
  })
})
