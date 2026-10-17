import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/services/keycloak.service', () => ({
  keycloak: { getState: () => ({ isAuthenticated: true }), subscribe: () => () => {} },
}))
vi.mock('@/api/course.api', () => ({
  courseApi: {
    list: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    addMembers: vi.fn(),
    removeMember: vi.fn(),
  },
}))
vi.mock('@/api/user.api', () => ({ userApi: { list: vi.fn(), search: vi.fn() } }))

import { courseApi } from '@/api/course.api'
import { userApi } from '@/api/user.api'
import CourseDetailView from '@/views/CourseDetailView'
import { useCourseStore } from '@/stores/course.store'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../helpers/render'

const course = { courseId: 'c-123', name: 'Vue 3 Masterclass', users: [] }

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderView = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/courses/:id" element={<CourseDetailView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/courses/c-123' },
  )

const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])
const setRole = (role: string) => useAuthStore.setState({ user: { userId: 'me', role } as any })

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  useCourseStore.setState({ courses: [], currentCourse: null, currentMembers: [], isLoading: false, error: null })
  setRole('teacher')
  vi.mocked(courseApi.getById).mockResolvedValue({ data: course } as any)
  vi.mocked(courseApi.list).mockResolvedValue({ data: [course] } as any)
  vi.mocked(userApi.list).mockResolvedValue({ data: [] } as any)
})

describe('CourseDetailView', () => {
  it('lädt den Kurs beim Start und zeigt den Namen an', async () => {
    renderView()

    expect(await screen.findByText('Vue 3 Masterclass')).toBeInTheDocument()
    expect(courseApi.getById).toHaveBeenCalledWith('c-123')
  })

  it('zeigt einen Fehler und navigiert zurück, wenn der Kurs nicht existiert', async () => {
    vi.mocked(courseApi.getById).mockRejectedValue(new Error('Not found'))
    renderView()

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/courses'))
    expect(toasts()).toContainEqual(['error', 'CourseDetailView.toasts.loadError'])
  })

  it('bearbeitet den Namen inline und speichert die Änderung', async () => {
    vi.mocked(courseApi.update).mockResolvedValue({ data: { ...course, name: 'Neu' } } as any)
    renderView()
    await screen.findByText('Vue 3 Masterclass')

    await userEvent.click(screen.getByTitle('CourseDetailView.editNameTitle'))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Neu')
    await userEvent.click(screen.getByTitle('CourseDetailView.save'))

    await waitFor(() => expect(courseApi.update).toHaveBeenCalledWith('c-123', { name: 'Neu' }))
    expect(toasts()).toContainEqual(['success', 'CourseDetailView.toasts.nameUpdated'])
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
  })

  it('bricht das Bearbeiten ab, ohne zu speichern', async () => {
    renderView()
    await screen.findByText('Vue 3 Masterclass')

    await userEvent.click(screen.getByTitle('CourseDetailView.editNameTitle'))
    await userEvent.click(screen.getByTitle('CourseDetailView.cancel'))

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(courseApi.update).not.toHaveBeenCalled()
  })

  it('speichert nicht, wenn der Name unverändert ist', async () => {
    renderView()
    await screen.findByText('Vue 3 Masterclass')

    await userEvent.click(screen.getByTitle('CourseDetailView.editNameTitle'))
    await userEvent.click(screen.getByTitle('CourseDetailView.save'))

    expect(courseApi.update).not.toHaveBeenCalled()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('bleibt im Bearbeiten-Modus, wenn das Speichern fehlschlägt', async () => {
    vi.mocked(courseApi.update).mockRejectedValue(new Error('boom'))
    renderView()
    await screen.findByText('Vue 3 Masterclass')

    await userEvent.click(screen.getByTitle('CourseDetailView.editNameTitle'))
    await userEvent.type(screen.getByRole('textbox'), 'X')
    await userEvent.click(screen.getByTitle('CourseDetailView.save'))

    await waitFor(() => expect(toasts()).toContainEqual(['error', 'CourseDetailView.toasts.nameUpdateError']))
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('versteckt Bearbeiten- und Hinzufügen-Buttons ohne Staff-Rechte', async () => {
    setRole('student')
    renderView()
    await screen.findByText('Vue 3 Masterclass')

    expect(screen.queryByTitle('CourseDetailView.editNameTitle')).not.toBeInTheDocument()
    expect(screen.queryByText('CourseDetailView.addMemberBtn')).not.toBeInTheDocument()
  })

  it('öffnet das Hinzufügen-Modal und lädt initiale Benutzer', async () => {
    vi.mocked(userApi.list).mockResolvedValue({ data: [{ userId: 'u-1', username: 'TestUser' }] } as any)
    renderView()
    await screen.findByText('Vue 3 Masterclass')

    await userEvent.click(screen.getByRole('button', { name: /CourseDetailView\.addMemberBtn/ }))

    expect(await screen.findByText('TestUser')).toBeInTheDocument()
    expect(userApi.list).toHaveBeenCalledWith({ role: 'student', limit: 100 })
  })

  it('wählt Nutzer aus und fügt sie hinzu', async () => {
    vi.mocked(userApi.list).mockResolvedValue({ data: [{ userId: 'u-1', username: 'TestUser' }] } as any)
    vi.mocked(courseApi.addMembers).mockResolvedValue({ data: [{ userId: 'u-1', username: 'TestUser' }] } as any)
    renderView()
    await screen.findByText('Vue 3 Masterclass')

    await userEvent.click(screen.getByRole('button', { name: /CourseDetailView\.addMemberBtn/ }))
    await userEvent.click(await screen.findByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: /CourseDetailView\.addModal\.addCount/ }))

    await waitFor(() => expect(courseApi.addMembers).toHaveBeenCalledWith('c-123', ['u-1']))
    expect(toasts()).toContainEqual(['success', 'CourseDetailView.toasts.membersAddedSingular'])
  })

  it('markiert vorhandene Mitglieder und Nutzer aus anderen Kursen', async () => {
    useCourseStore.setState({ courses: [{ courseId: 'other', name: 'Anderer Kurs' } as any] })
    vi.mocked(courseApi.getById).mockResolvedValue({
      data: { ...course, users: [{ userId: 'm-1', username: 'Member', role: 'student' }] },
    } as any)
    vi.mocked(userApi.list).mockResolvedValue({
      data: [
        { userId: 'm-1', username: 'Member' },
        { userId: 'o-1', username: 'Elsewhere', courseId: 'other' },
      ],
    } as any)
    renderView()
    await screen.findByText('Vue 3 Masterclass')

    await userEvent.click(screen.getByRole('button', { name: /CourseDetailView\.addMemberBtn/ }))

    expect(await screen.findByText('CourseDetailView.addModal.alreadyMember')).toBeInTheDocument()
    expect(screen.getByText(/CourseDetailView\.addModal\.inOtherCourse/)).toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
  })

  it('öffnet das Entfernen-Modal und entfernt einen Benutzer', async () => {
    vi.mocked(courseApi.getById).mockResolvedValue({
      data: { ...course, users: [{ userId: 'u-99', username: 'BadUser', role: 'student' }] },
    } as any)
    vi.mocked(courseApi.removeMember).mockResolvedValue({} as any)
    renderView()
    await screen.findByText('BadUser')

    await userEvent.click(screen.getByTitle('CourseDetailView.removeMemberTitle'))
    const dialog = document.querySelector('.fixed.inset-0') as HTMLElement
    await userEvent.click(within(dialog).getByRole('button', { name: 'CourseDetailView.removeModal.remove' }))

    await waitFor(() => expect(courseApi.removeMember).toHaveBeenCalledWith('c-123', 'u-99'))
    expect(toasts()).toContainEqual(['success', 'CourseDetailView.toasts.memberRemoved'])
    await waitFor(() => expect(document.querySelector('.fixed.inset-0')).toBeNull())
  })
})
