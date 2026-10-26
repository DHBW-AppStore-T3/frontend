import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/api/course.api', () => ({ courseApi: { list: vi.fn(), getById: vi.fn() } }))
vi.mock('@/api/app.api', () => ({ appApi: { getRuntime: vi.fn() } }))
vi.mock('@/api/user.api', () => ({ userApi: { list: vi.fn(), search: vi.fn() } }))

import { appApi } from '@/api/app.api'
import { courseApi } from '@/api/course.api'
import { userApi } from '@/api/user.api'
import NewDeploymentConfigView from '@/views/NewDeploymentConfigView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderView = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/deployment/new/config" element={<NewDeploymentConfigView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/deployment/new/config' },
  )

const draft = () => useDeploymentStore.getState().draft
const warnings = () => useToastStore.getState().toasts.filter((t) => t.type === 'warning').map((t) => t.message)

const john = { userId: 'u1', firstName: 'John', lastName: 'Doe' }
const jane = { userId: 'u2', firstName: 'Jane', lastName: 'Roe' }

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useDeploymentStore.getState().resetDraft()
  useDeploymentStore.getState().updateDraft({ appId: 'app-1', releaseTag: 'v1', runtime: 'kubernetes', scope: 'team' })
  useDeploymentStore.getState().studentCache.clear()
  vi.mocked(appApi.getRuntime).mockResolvedValue({ data: { runtime: 'kubernetes', scope: 'team' } } as any)
  vi.mocked(courseApi.list).mockResolvedValue({ data: [{ courseId: 'c1', name: 'Web Dev' }] } as any)
  vi.mocked(courseApi.getById).mockResolvedValue({ data: { users: [john, jane] } } as any)
  vi.mocked(userApi.list).mockResolvedValue({ data: [john, jane] } as any)
  vi.mocked(userApi.search).mockResolvedValue({ data: [jane] } as any)
})

describe('NewDeploymentConfigView', () => {
  it('lädt Kurse und Studierende und zeigt die Teilnehmerzahl je Kurs', async () => {
    renderView()

    expect(await screen.findByText('Web Dev')).toBeInTheDocument()
    expect(userApi.list).toHaveBeenCalledWith({ role: 'student', limit: 1000 })
    await waitFor(() => expect(courseApi.getById).toHaveBeenCalledWith('c1'))
  })

  describe('Laufzeit', () => {
    it('das Formular ist sofort sichtbar', async () => {
      renderView()

      expect(await screen.findByTestId('deployment-name')).toBeInTheDocument()
      expect(screen.getByTestId('btn-next')).toBeEnabled()
    })

    it('fragt die Laufzeit erneut, wenn der Entwurf nach einem Reload keine hat', async () => {
      useDeploymentStore.getState().updateDraft({ runtime: null, scope: null })
      vi.mocked(appApi.getRuntime).mockResolvedValue({ data: { runtime: 'kubernetes', scope: 'user' } } as any)
      renderView()

      await waitFor(() => expect(appApi.getRuntime).toHaveBeenCalledWith('app-1', 'v1'))
      await waitFor(() => expect(draft().runtime).toBe('kubernetes'))
      expect(draft().scope).toBe('user')
    })

    it('meldet einen Fehler, wenn die Laufzeit nicht ermittelt werden kann', async () => {
      useDeploymentStore.getState().updateDraft({ runtime: null })
      vi.mocked(appApi.getRuntime).mockRejectedValue(new Error('boom'))
      renderView()

      await waitFor(() =>
        expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('AppsDetailView.runtime.loadError'),
      )
    })
  })

  it('verlangt einen Namen, bevor es weitergeht', async () => {
    renderView()
    await screen.findByText('Web Dev')

    await userEvent.click(screen.getByTestId('btn-next'))

    expect(
      useToastStore.getState().toasts.filter((t) => t.type === 'warning').map((t) => t.message),
    ).toContain('deployment.errors.missingName')
    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/config')
  })

  it('verlangt mindestens einen Studierenden', async () => {
    renderView()
    await screen.findByText('Web Dev')
    await userEvent.type(screen.getByTestId('deployment-name'), 'Mein Lab')

    await userEvent.click(screen.getByTestId('btn-next'))

    expect(warnings()).toContain('deployment.errors.missingStudents')
  })

  it('geht zum nächsten Schritt, wenn alles ausgefüllt ist', async () => {
    renderView()
    await screen.findByText('Web Dev')
    await userEvent.type(screen.getByTestId('deployment-name'), 'Mein Lab')
    await userEvent.click(screen.getByTestId('course-c1'))
    await waitFor(() => expect(draft().studentIds).toEqual(['u1', 'u2']))

    await userEvent.click(screen.getByTestId('btn-next'))

    expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/teams')
  })

  it('wählt einen Kurs komplett aus und wieder ab, und synchronisiert courseIds', async () => {
    renderView()
    await screen.findByText('Web Dev')

    await userEvent.click(screen.getByTestId('course-c1'))
    await waitFor(() => expect(draft().courseIds).toEqual(['c1']))

    await userEvent.click(screen.getByTestId('course-c1'))
    await waitFor(() => expect(draft().studentIds).toEqual([]))
    expect(draft().courseIds).toEqual([])
  })

  it('warnt, wenn ein Kurs keine Studierenden hat', async () => {
    vi.mocked(courseApi.getById).mockResolvedValue({ data: { users: [] } } as any)
    renderView()
    await userEvent.click(await screen.findByTestId('course-c1'))

    await waitFor(() => expect(warnings()).toContain('CourseDetailView.addModal.noUsersFound'))
  })

  it('sucht einzelne Studierende und wählt sie aus', async () => {
    renderView()
    await screen.findByText('Web Dev')
    await userEvent.click(screen.getByRole('button', { name: /deployment\.config\.studentsLabel/ }))

    // Without a query no list is shown.
    expect(screen.queryByTestId('student-u1')).not.toBeInTheDocument()

    await userEvent.type(screen.getByTestId('student-search'), 'Ja')
    // Debounced (300ms): the backend search runs once typing has settled.
    await waitFor(() => expect(userApi.search).toHaveBeenCalledWith('Ja', 50))
    await waitFor(() => expect(screen.queryByTestId('student-u1')).not.toBeInTheDocument())
    await userEvent.click(await screen.findByTestId('student-u2'))

    expect(draft().studentIds).toEqual(['u2'])
    // The selection panel shows the chosen student with a remove button.
    await userEvent.click(screen.getByTestId('remove-u2'))
    expect(draft().studentIds).toEqual([])
  })

  it('geht über „Zurück" zur App-Detailseite', async () => {
    renderView()
    await screen.findByText('Web Dev')

    await userEvent.click(screen.getByTestId('btn-back'))

    expect(screen.getByTestId('where')).toHaveTextContent('/apps/app-1')
  })

  it('geht ohne gewählte App zurück zur App-Liste', async () => {
    useDeploymentStore.getState().updateDraft({ appId: null })
    renderView()
    await screen.findByText('Web Dev')

    await userEvent.click(screen.getByTestId('btn-back'))

    expect(screen.getByTestId('where').textContent).toBe('/apps')
  })
})
