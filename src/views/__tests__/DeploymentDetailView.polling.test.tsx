import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import type { DeploymentWithRelations } from '@/types'

// A fake backend: the status flips `switchAfterMs` after the test starts.
const backend = vi.hoisted(() => ({ status: 'running', calls: 0 }))

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/task.api', () => ({
  taskApi: { listByDeployment: vi.fn(async () => ({ data: [] })), getById: vi.fn() },
}))
vi.mock('@/api/deployment.api', () => ({
  deploymentApi: {
    getById: vi.fn(async () => {
      backend.calls += 1
      return { data: snapshot() }
    }),
    getMyAccess: vi.fn(async () => ({ data: { user_accounts: null, team_vms: null } })),
    listResources: vi.fn(async () => ({ data: { resources: [], workloads: [], live: true } })),
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

const STUDENT = { owner_view: false, operate: false, member: true }
const OWNER = { owner_view: true, operate: true, member: false }
let permissions = STUDENT

function snapshot(): DeploymentWithRelations {
  return {
    deploymentId: 'dep-1',
    name: 'Data Lab',
    appId: 'app-1',
    userId: 'user-owner',
    status: backend.status,
    userInputVar: null,
    releaseTag: 'v1',
    created_at: '2026-06-08T12:00:00Z',
    runtime: 'kubevirt-vm',
    permissions,
    actions: [],
    teams: [],
    outputs: null,
    logs: null,
    latest_task: null,
  } as unknown as DeploymentWithRelations
}

const tick = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })

async function openView() {
  render(
    <I18nextProvider i18n={appI18n}>
      <MemoryRouter initialEntries={['/deployments/dep-1']}>
        <Routes>
          <Route path="/deployments/:id" element={<DeploymentDetailView />} />
          <Route path="/deployments" element={<p>list</p>} />
        </Routes>
      </MemoryRouter>
    </I18nextProvider>,
  )
  await tick(0) // initial load
}

beforeEach(async () => {
  vi.useFakeTimers()
  await appI18n.changeLanguage('de')
  backend.status = 'running'
  backend.calls = 0
  permissions = STUDENT
  useDeploymentStore.setState({ currentDeployment: null, isLoading: false, error: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('DeploymentDetailView status polling (student)', () => {
  it('shows "erfolgreich" within 30 s of the backend finishing, and then stops asking', async () => {
    await openView()
    expect(screen.getByText('läuft')).toBeInTheDocument()
    const initialCalls = backend.calls

    await tick(3_000)
    backend.status = 'success'
    await tick(27_000)

    expect(screen.getByText('erfolgreich')).toBeInTheDocument()
    const after = backend.calls
    expect(after).toBeGreaterThan(initialCalls)
    await tick(60_000)
    expect(backend.calls).toBe(after)
  })

  it('shows "fehlgeschlagen" and the hint within 30 s of a failure, and then stops asking', async () => {
    await openView()
    await tick(3_000)
    backend.status = 'failed'
    await tick(27_000)

    expect(screen.getByText('fehlgeschlagen')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Die Lernumgebung kann derzeit nicht genutzt werden. Bitte wenden Sie sich an Ihre Dozentin oder Ihren Dozenten.',
    )
    const after = backend.calls
    await tick(60_000)
    expect(backend.calls).toBe(after)
  })

  it('shows the hint right away for an already failed deployment, without polling', async () => {
    backend.status = 'failed'
    await openView()

    expect(screen.getByRole('alert')).toBeInTheDocument()
    const calls = backend.calls
    await tick(60_000)
    expect(backend.calls).toBe(calls)
  })
})

describe('DeploymentDetailView status polling (owner view)', () => {
  it('neither polls nor shows the hint', async () => {
    permissions = OWNER
    await openView()
    const calls = backend.calls
    await tick(60_000)

    expect(backend.calls).toBe(calls)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
