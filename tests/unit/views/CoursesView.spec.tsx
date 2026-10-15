import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/course.api', () => ({
  courseApi: { list: vi.fn(), listMembers: vi.fn(), create: vi.fn(), delete: vi.fn() },
}))

import { courseApi } from '@/api/course.api'
import CoursesView from '@/views/CoursesView'
import { useCourseStore } from '@/stores/course.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import de from '@/i18n/locales/de'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderView = (realI18n = false) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/courses" element={<CoursesView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/courses', realI18n },
  )

const setRole = (role: string) => useAuthStore.setState({ user: { userId: 'u', role } as any })
const toastMessages = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useCourseStore.setState({ courses: [], isLoading: false, error: null })
  setRole('teacher')
  vi.mocked(courseApi.list).mockResolvedValue({ data: [] } as any)
  vi.mocked(courseApi.listMembers).mockResolvedValue({ data: [] } as any)
})

describe('CoursesView', () => {
  // --- Loading and empty states ---
  it('zeigt den Loading-Text, wenn Daten geladen werden', () => {
    vi.mocked(courseApi.list).mockReturnValue(new Promise(() => {}))
    renderView()
    expect(screen.getByText('CoursesView.loading')).toBeInTheDocument()
  })

  it('zeigt den Empty-State, wenn keine Kurse existieren', async () => {
    renderView()
    expect(await screen.findByText('CoursesView.noCourses')).toBeInTheDocument()
    expect(screen.getByText('CoursesView.createFirst')).toBeInTheDocument()
  })

  // --- Data & member counts ---
  it('rendert Kurse und holt die Mitgliederanzahl (Fehler zählen als 0)', async () => {
    vi.mocked(courseApi.list).mockResolvedValue({
      data: [
        { courseId: 'c-1', name: 'Vue JS Kurs' },
        { courseId: 'c-2', name: 'Python Kurs' },
      ],
    } as any)
    vi.mocked(courseApi.listMembers).mockImplementation(((id: string) =>
      id === 'c-1' ? Promise.resolve({ data: ['u1', 'u2'] }) : Promise.reject(new Error('nope'))) as any)
    renderView()

    expect(await screen.findByText('Vue JS Kurs')).toBeInTheDocument()
    expect(screen.getByText('Python Kurs')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/^2\s+CoursesView\.memberPlural/)).toBeInTheDocument())
    expect(screen.getByText(/^0\s+CoursesView\.memberPlural/)).toBeInTheDocument()
  })

  it('verlinkt jeden Kurs auf seine Detailseite', async () => {
    vi.mocked(courseApi.list).mockResolvedValue({ data: [{ courseId: 'c-99', name: 'Klick Test' }] } as any)
    renderView()

    const link = await screen.findByRole('link', { name: /Klick Test/ })
    expect(link).toHaveAttribute('href', '/courses/c-99')
  })

  it('filtert nach Suchbegriff', async () => {
    vi.mocked(courseApi.list).mockResolvedValue({
      data: [
        { courseId: '1', name: 'Mathe' },
        { courseId: '2', name: 'Physik' },
      ],
    } as any)
    renderView()
    await screen.findByText('Mathe')

    await userEvent.type(screen.getByRole('searchbox'), 'phy')

    expect(screen.queryByText('Mathe')).not.toBeInTheDocument()
    expect(screen.getByText('Physik')).toBeInTheDocument()
  })

  // --- Permissions ---
  it('versteckt Erstellen-Buttons für Nicht-Staff', async () => {
    setRole('student')
    renderView()
    await screen.findByText('CoursesView.noCourses')

    expect(screen.queryByText('CoursesView.newCourse')).not.toBeInTheDocument()
    expect(screen.queryByText('CoursesView.createFirst')).not.toBeInTheDocument()
  })

  it('versteckt Löschen und Mitgliederanzahl für Nicht-Staff und lädt keine Mitglieder', async () => {
    setRole('student')
    vi.mocked(courseApi.list).mockResolvedValue({ data: [{ courseId: 'c-1', name: 'Test Kurs' }] } as any)
    renderView()
    await screen.findByText('Test Kurs')

    expect(courseApi.listMembers).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('CoursesView.deleteTitle')).not.toBeInTheDocument()
    expect(screen.queryByText(/CoursesView\.memberPlural/)).not.toBeInTheDocument()
    expect(screen.getByText('CoursesView.openToView')).toBeInTheDocument()
  })

  // --- Create ---
  it('erstellt einen Kurs und navigiert zur Detailseite', async () => {
    vi.mocked(courseApi.create).mockResolvedValue({ data: { courseId: 'new-c-1', name: 'Mein neuer Kurs' } } as any)
    renderView()
    await screen.findByText('CoursesView.noCourses')

    await userEvent.click(screen.getAllByRole('button', { name: /CoursesView\.newCourse/ })[0]!)
    const create = screen.getByRole('button', { name: 'CoursesView.createModal.create' })
    expect(create).toBeDisabled()

    await userEvent.type(screen.getByPlaceholderText('CoursesView.createModal.namePlaceholder'), 'Mein neuer Kurs')
    await userEvent.click(create)

    await waitFor(() =>
      expect(courseApi.create).toHaveBeenCalledWith({ name: 'Mein neuer Kurs' }),
    )
    expect(toastMessages()).toContainEqual(['success', 'CoursesView.toasts.createSuccess'])
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/courses/new-c-1'))
  })

  it('zeigt den Backend-Fehler, wenn das Erstellen fehlschlägt', async () => {
    vi.mocked(courseApi.create).mockRejectedValue({ response: { data: { detail: 'Backend Error' } } })
    renderView()
    await screen.findByText('CoursesView.noCourses')

    await userEvent.click(screen.getAllByRole('button', { name: /CoursesView\.newCourse/ })[0]!)
    await userEvent.type(screen.getByPlaceholderText('CoursesView.createModal.namePlaceholder'), 'Fail Kurs')
    await userEvent.click(screen.getByRole('button', { name: 'CoursesView.createModal.create' }))

    await waitFor(() => expect(toastMessages()).toContainEqual(['error', 'Backend Error']))
  })

  // --- Delete ---
  it('löscht einen Kurs nach Bestätigung', async () => {
    vi.mocked(courseApi.list).mockResolvedValue({ data: [{ courseId: 'c-77', name: 'Zu löschender Kurs' }] } as any)
    vi.mocked(courseApi.delete).mockResolvedValue({} as any)
    // Real translations: the course name is interpolated into the prompt.
    renderView(true)
    await screen.findByText('Zu löschender Kurs')

    await userEvent.click(screen.getByLabelText(de.CoursesView.deleteTitle))
    // The list's icon button and the dialog's confirm share the label: scope to the dialog.
    const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
    expect(within(dialog).getByText(/Zu löschender Kurs/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: de.CoursesView.deleteModal.delete }))

    await waitFor(() => expect(courseApi.delete).toHaveBeenCalledWith('c-77'))
    expect(toastMessages()).toContainEqual(['success', 'CoursesView.toasts.deleteSuccess'])
    await waitFor(() => expect(screen.queryByText('Zu löschender Kurs')).not.toBeInTheDocument())
  })

  it('escaped Kursnamen im Löschdialog', async () => {
    vi.mocked(courseApi.list).mockResolvedValue({
      data: [{ courseId: 'x', name: '<img src=x onerror=alert(1)>' }],
    } as any)
    renderView()
    await userEvent.click(await screen.findByLabelText('CoursesView.deleteTitle'))

    expect(document.querySelector('.fixed img')).toBeNull()
  })
})
