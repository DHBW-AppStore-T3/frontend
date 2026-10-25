import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { DeploymentWithRelations } from '@/types'

const state = vi.hoisted(() => ({ runtime: 'kubevirt-vm' as string }))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/task.api', () => ({
  taskApi: { listByDeployment: vi.fn(async () => ({ data: [] })), getById: vi.fn() },
}))
vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    getById: vi.fn(async () => ({ data: snapshot() })),
    getMyAccess: vi.fn(async () => ({ data: { user_accounts: null, team_vms: null } })),
    listResources: vi.fn(async () => ({
      data: {
        resources: [],
        runtime: state.runtime,
        live: true,
        workloads: [
          { workload: 'desktop-a', team: 'Team A', user_id: null, ready: true, restarts: 0, phase: 'Running', url: null, lastEvent: null },
        ],
      },
    })),
  },
}))
vi.mock('@/composables/useDeploymentStream', () => ({
  useDeploymentStream: () => ({
    progress: null, currentPhase: null, currentPhaseIndex: null, totalPhases: 11,
    phaseNames: [], liveLogs: [], totalLogCount: 0, connectionState: 'idle', lastError: null,
    start: vi.fn(), stop: vi.fn(),
  }),
}))

import DeploymentDetailView from '@/views/DeploymentDetailView'
import { useDeploymentStore } from '@/stores/deployment.store'
import appI18n from '@/i18n'

function snapshot(): DeploymentWithRelations {
  return {
    deploymentId: 'dep-1',
    name: 'Win Lab',
    appId: 'app-1',
    userId: 'user-owner',
    status: 'success',
    userInputVar: null,
    releaseTag: 'v1',
    created_at: '2026-06-08T12:00:00Z',
    runtime: state.runtime,
    permissions: { owner_view: true, operate: true, member: false },
    actions: ['redeploy', 'destroy', 'delete', 'pause'],
    teams: [],
    outputs: null,
    logs: null,
    latest_task: null,
  } as unknown as DeploymentWithRelations
}

async function openView() {
  render(
    <I18nextProvider i18n={appI18n}>
      <MemoryRouter initialEntries={['/deployments/dep-1']}>
        <Routes>
          <Route path="/deployments/:id" element={<DeploymentDetailView />} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
  return screen.findByTestId('pod-workloads')
}

beforeEach(async () => {
  await appI18n.changeLanguage('de')
  useDeploymentStore.setState({ currentDeployment: null, isLoading: false, error: null })
})

describe('DeploymentDetailView of a cluster deployment', () => {
  it('lists the VM row of a kubevirt-vm deployment without restart and reset', async () => {
    state.runtime = 'kubevirt-vm'
    await openView()
    expect(await screen.findByTestId('workload-desktop-a')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Neu starten/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Zurücksetzen/ })).toBeNull()
  })

  it('offers restart and reset for the workloads of a pod deployment', async () => {
    state.runtime = 'kubernetes'
    await openView()
    await screen.findByTestId('workload-desktop-a')
    expect(await screen.findByRole('button', { name: /Neu starten/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Zurücksetzen/ })).toBeInTheDocument()
  })

  it('names the VM, not pods, in the delete confirmation of a kubevirt-vm deployment', async () => {
    state.runtime = 'kubevirt-vm'
    await openView()
    await userEvent.click(await screen.findByTestId('btn-delete-deployment'))
    expect(await screen.findByText(/Namespace mit der VM/)).toBeInTheDocument()
    expect(screen.queryByText(/allen Pods/)).toBeNull()
  })

  it('still names the pods for a pod deployment', async () => {
    state.runtime = 'kubernetes'
    await openView()
    await userEvent.click(await screen.findByTestId('btn-delete-deployment'))
    expect(await screen.findByText(/allen Pods/)).toBeInTheDocument()
  })
})
