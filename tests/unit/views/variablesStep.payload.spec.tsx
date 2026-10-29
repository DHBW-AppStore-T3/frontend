import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

import NewDeploymentVariableView from '@/views/NewDeploymentVariableView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useAppStore } from '@/stores/app.store'
import { buildDeploymentPayload } from '@/utils/deployment-payload'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const draft = () => useDeploymentStore.getState().draft

/** The draft the wizard has after steps 1 and 2 for an app without variables, choices and network. */
function seedAppWithoutSettings() {
  const store = useDeploymentStore.getState()
  store.resetDraft()
  store.updateDraft({
    appId: 'app-1',
    name: 'Lab',
    releaseTag: '1.0.0',
    studentIds: ['u1', 'u2'],
    groupMode: 'one',
    groupCount: 1,
    groupNames: ['Team 1'],
    assignments: [['u1', 'u2']],
    runtime: 'kubernetes',
    scope: 'team',
    resourceChoices: [],
    resources: {},
    networkChoices: {},
    network: {},
    variableDefinitions: [],
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useAppStore.setState({ fetchAppVariables: vi.fn().mockResolvedValue([]) } as never)
  seedAppWithoutSettings()
})

describe('the deployment sent for an app without variables', () => {
  it('is the same whether or not the variables step was visited', async () => {
    const skipped = buildDeploymentPayload(draft())

    // Visit step 3 for the same draft and press "Weiter": the step saves its (empty) answer.
    seedAppWithoutSettings()
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
    await userEvent.click(await screen.findByRole('button', { name: /deployment\.actions\.next/ }))
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/summary'))
    expect(draft().userInputVar).toBe('{}') // the step did save something
    const visited = buildDeploymentPayload(draft())

    expect(visited).toStrictEqual(skipped)
  })

  it('carries no variables, resources or network (empty ones are left out) and the teams of the draft', () => {
    const payload = buildDeploymentPayload(draft())

    expect(payload).toStrictEqual({
      name: 'Lab',
      appId: 'app-1',
      releaseTag: '1.0.0',
      userInputVar: { terraform: {} },
      teams: [{ name: 'Team 1', userIds: ['u1', 'u2'] }],
    })
  })
})
