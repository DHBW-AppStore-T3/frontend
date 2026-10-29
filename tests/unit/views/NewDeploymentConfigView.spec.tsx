import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/api/course.api', () => ({ courseApi: { list: vi.fn(), getById: vi.fn() } }))
vi.mock('@/api/app.api', () => ({ appApi: { getRuntime: vi.fn(), getVariables: vi.fn() } }))
vi.mock('@/api/user.api', () => ({ userApi: { list: vi.fn(), search: vi.fn(), getById: vi.fn() } }))

import { appApi } from '@/api/app.api'
import { courseApi } from '@/api/course.api'
import { userApi } from '@/api/user.api'
import NewDeploymentConfigView from '@/views/NewDeploymentConfigView'
import NewDeploymentGroupsAssignmentView from '@/views/NewDeploymentGroupsAssignmentView'
import { useDeploymentStore } from '@/stores/deployment.store'
import { useToastStore } from '@/stores/toast.store'
import { buildDeploymentPayload } from '@/utils/deployment-payload'
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

// Steps 1 and 2 on their own routes, for the way back from the teams.
const renderSteps = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/deployment/new/config" element={<NewDeploymentConfigView />} />
        <Route path="/deployment/new/teams" element={<NewDeploymentGroupsAssignmentView />} />
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
  vi.mocked(appApi.getVariables).mockResolvedValue({ data: [] } as any)
  vi.mocked(courseApi.list).mockResolvedValue({ data: [{ courseId: 'c1', name: 'Web Dev' }] } as any)
  vi.mocked(courseApi.getById).mockResolvedValue({ data: { users: [john, jane] } } as any)
  vi.mocked(userApi.list).mockResolvedValue({ data: [john, jane] } as any)
  vi.mocked(userApi.search).mockResolvedValue({ data: [jane] } as any)
})

describe('NewDeploymentConfigView', () => {
  it('names the deployment name field by its label (#141)', async () => {
    renderView()
    expect(await screen.findByRole('textbox', { name: 'deployment.config.nameLabel' })).toBe(
      screen.getByTestId('deployment-name'),
    )
  })

  it('names the student search field (#141)', async () => {
    renderView()
    await screen.findByText('Web Dev')
    await userEvent.click(screen.getByRole('button', { name: /deployment\.config\.studentsLabel/ }))
    expect(screen.getByRole('textbox', { name: 'deployment.config.searchPlaceholder' })).toBe(
      screen.getByTestId('student-search'),
    )
  })

  it('lädt Kurse und Studierende und zeigt die Teilnehmerzahl je Kurs', async () => {
    renderView()

    expect(await screen.findByText('Web Dev')).toBeInTheDocument()
    expect(userApi.list).toHaveBeenCalledWith({ role: 'student', limit: 1000 })
    await waitFor(() => expect(courseApi.getById).toHaveBeenCalledWith('c1'))
  })

  describe('Variablen-Definitionen vorladen', () => {
    it('fragt beim Betreten die Variablen der App ab, damit die Antwort in Schritt 2 da ist', async () => {
      renderView()

      await waitFor(() => expect(appApi.getVariables).toHaveBeenCalledExactlyOnceWith('app-1', 'v1'))
      await waitFor(() => expect(draft().variableDefinitions).toEqual([]))
    })

    it('zeigt vier Schritte, bis die Antwort da ist, und drei, wenn die App nichts einzustellen hat', async () => {
      renderView()
      await screen.findByText('Web Dev')

      await waitFor(() => expect(screen.queryByText('deployment.steps.vars')).not.toBeInTheDocument())
      expect(screen.getByText('deployment.steps.summary')).toBeInTheDocument()
    })

    it('zeigt vier Schritte, wenn die App Variablen hat', async () => {
      vi.mocked(appApi.getVariables).mockResolvedValue({ data: [{ name: 'region', source: 'terraform' }] } as any)
      renderView()
      await screen.findByText('Web Dev')

      await waitFor(() => expect(draft().variableDefinitions).toHaveLength(1))
      expect(screen.getByText('deployment.steps.vars')).toBeInTheDocument()
    })

    it('verschluckt einen Ladefehler: keine Meldung, der Schritt bleibt in der Leiste', async () => {
      vi.mocked(appApi.getVariables).mockRejectedValue(new Error('boom'))
      renderView()
      await screen.findByText('Web Dev')

      await waitFor(() => expect(appApi.getVariables).toHaveBeenCalled())
      expect(useToastStore.getState().toasts.filter((t) => t.type === 'error')).toEqual([])
      expect(draft().variableDefinitions).toBeUndefined()
      expect(screen.getByText('deployment.steps.vars')).toBeInTheDocument()
    })

    it('fragt nicht, wenn keine App im Entwurf ist', async () => {
      useDeploymentStore.getState().updateDraft({ appId: null })
      renderView()
      await screen.findByText('Web Dev')

      expect(appApi.getVariables).not.toHaveBeenCalled()
    })
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

  it('räumt beim Öffnen keine fremden Hinweise weg, wenn die Wartezeit der Suche abläuft', async () => {
    vi.useFakeTimers()
    try {
      renderView()
      useToastStore.getState().warning('bleibt stehen')

      // 300 ms Wartezeit der Suche (DEBOUNCE_MS) plus Reserve, aber weit unter den 5 s des Toasts
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })

      expect(warnings()).toContain('bleibt stehen')
    } finally {
      vi.useRealTimers()
    }
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

  describe('Tastaturbedienung (#154)', () => {
    it('Kurse sind Checkboxen mit Zustand und lassen sich mit Leertaste und Enter wählen', async () => {
      renderView()
      await screen.findByText('Web Dev')

      const course = screen.getByRole('checkbox', { name: /Web Dev/ })
      expect(course).toHaveAttribute('aria-checked', 'false')
      expect(course).toHaveAttribute('data-testid', 'course-c1')

      await userEvent.tab() // name field
      course.focus()
      await userEvent.keyboard(' ')
      await waitFor(() => expect(course).toHaveAttribute('aria-checked', 'true'))
      expect(draft().courseIds).toEqual(['c1'])

      await userEvent.keyboard('{Enter}')
      await waitFor(() => expect(course).toHaveAttribute('aria-checked', 'false'))
      expect(draft().courseIds).toEqual([])
    })

    it('andere Tasten auf einem Kurs wählen nichts', async () => {
      renderView()
      await screen.findByText('Web Dev')
      screen.getByTestId('course-c1').focus()

      await userEvent.keyboard('a{Escape}')

      expect(draft().courseIds).toEqual([])
    })

    it('Studierende sind Checkboxen, per Tastatur wählbar', async () => {
      renderView()
      await screen.findByText('Web Dev')
      await userEvent.click(screen.getByRole('button', { name: /deployment\.config\.studentsLabel/ }))
      await userEvent.type(screen.getByTestId('student-search'), 'Ja')
      const student = await screen.findByTestId('student-u2')
      await waitFor(() => expect(screen.queryByTestId('student-u1')).not.toBeInTheDocument())

      expect(student).toHaveAttribute('role', 'checkbox')
      expect(student).toHaveAttribute('aria-checked', 'false')
      student.focus()
      await userEvent.keyboard(' ')

      expect(draft().studentIds).toEqual(['u2'])
      expect(screen.getByTestId('student-u2')).toHaveAttribute('aria-checked', 'true')
    })
  })

  describe('Hinweise während der Suche', () => {
    const messages = () => useToastStore.getState().toasts.map((t) => t.message)
    const openSearch = async () => {
      renderView()
      await screen.findByText('Web Dev')
      await userEvent.click(screen.getByRole('button', { name: /deployment\.config\.studentsLabel/ }))
    }

    it('lässt fremde Warnungen und Fehler stehen, auch nach einer abgeschlossenen Suche', async () => {
      await openSearch()
      await userEvent.type(screen.getByTestId('student-search'), 'Ja')
      useToastStore.getState().warning('fremde Warnung')
      useToastStore.getState().error('fremder Fehler')

      await waitFor(() => expect(userApi.search).toHaveBeenCalledWith('Ja', 50))
      // The result list is set right after the search finished.
      await screen.findByTestId('student-u2')

      expect(messages()).toContain('fremde Warnung')
      expect(messages()).toContain('fremder Fehler')
    })

    it('entfernt nur den Fehlerhinweis der Suche, sobald eine spätere Suche gelingt', async () => {
      vi.mocked(userApi.search).mockRejectedValueOnce(new Error('Suche kaputt'))
      await openSearch()
      await userEvent.type(screen.getByTestId('student-search'), 'Ja')
      await waitFor(() => expect(messages()).toContain('Suche kaputt'))
      useToastStore.getState().warning('fremde Warnung')

      await userEvent.type(screen.getByTestId('student-search'), 'ne')
      await waitFor(() => expect(userApi.search).toHaveBeenCalledWith('Jane', 50))
      await waitFor(() => expect(messages()).not.toContain('Suche kaputt'))

      expect(messages()).toContain('fremde Warnung')
    })
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
  describe('Studierende abwählen, nachdem die Teams festgelegt waren', () => {
    // The state after step 2 with "Ein Team für alle", and the way back to step 1.
    const withTeams = (over: Record<string, unknown> = {}) =>
      useDeploymentStore.getState().updateDraft({
        name: 'Mein Lab',
        studentIds: ['u1', 'u2'],
        groupMode: 'one',
        groupCount: 1,
        groupNames: ['VM-1'],
        assignments: [['u1', 'u2']],
        ...over,
      } as any)

    it('entfernt den abgewählten Studierenden aus dem Team', async () => {
      withTeams()
      renderView()

      await userEvent.click(await screen.findByTestId('remove-u2'))

      expect(draft().studentIds).toEqual(['u1'])
      expect(draft().assignments).toEqual([['u1']])
    })

    it('schickt den abgewählten Studierenden nicht mit der Nutzlast', async () => {
      withTeams()
      renderView()

      await userEvent.click(await screen.findByTestId('remove-u2'))

      expect(buildDeploymentPayload(draft()).teams).toEqual([{ name: 'VM-1', userIds: ['u1'] }])
    })

    it('entfernt ihn auch, wenn ein ganzer Kurs abgewählt wird, und lässt die Teams leer stehen', async () => {
      withTeams({ groupMode: 'custom', groupCount: 2, groupNames: ['A', 'B'], assignments: [['u1'], ['u2']] })
      renderView()
      await screen.findByTestId('remove-u2')
      await userEvent.click(screen.getByTestId('course-c1'))
      // Everybody of the course is selected: the click deselects them all.
      await waitFor(() => expect(draft().studentIds).toEqual([]))

      expect(draft().assignments).toEqual([[], []])
      expect(draft().groupNames).toEqual(['A', 'B'])
    })

    it('lässt die Teams unberührt, wenn jemand dazukommt', async () => {
      withTeams({ studentIds: ['u1'], assignments: [['u1']] })
      renderView()
      await screen.findByText('Web Dev')

      await userEvent.click(screen.getByTestId('course-c1'))
      await waitFor(() => expect(draft().studentIds).toEqual(['u1', 'u2']))

      expect(draft().assignments).toEqual([['u1']])
    })

    it('"Weiter" in Schritt 2 ist offen, und die Nutzlast kennt nur noch die gewählte Person', async () => {
      withTeams()
      renderSteps()
      await userEvent.click(await screen.findByTestId('remove-u2'))

      await userEvent.click(screen.getByTestId('btn-next'))
      // Wait for something only step 2 renders: the path changes before the view does.
      await screen.findByRole('button', { name: 'deployment.groups.one' })

      expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/teams')
      expect(screen.getByTestId('btn-next')).toBeEnabled()
      expect(draft().assignments).toEqual([['u1']])
      expect(buildDeploymentPayload(draft()).teams).toEqual([{ name: 'VM-1', userIds: ['u1'] }])
    })

    it('in Schritt 2 bleibt die Person weg und "Weiter" gesperrt, wenn ein Team danach leer ist', async () => {
      withTeams({ groupMode: 'custom', groupCount: 2, groupNames: ['A', 'B'], assignments: [['u1'], ['u2']] })
      renderSteps()
      await userEvent.click(await screen.findByTestId('remove-u2'))

      await userEvent.click(screen.getByTestId('btn-next'))
      await screen.findByRole('button', { name: 'deployment.groups.one' })

      expect(draft().assignments).toEqual([['u1'], []])
      expect(screen.getByTestId('btn-next')).toBeDisabled()
    })
  })
})
