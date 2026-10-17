// @vitest-environment jsdom
// MarkdownEditor/Renderer sanitise through DOMPurify, which needs a spec-complete DOM.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

vi.mock('@/api/app.api', () => ({ appApi: { create: vi.fn() } }))

import { appApi } from '@/api/app.api'
import AddAppsView from '@/views/AddAppsView'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderView = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/apps/create" element={<AddAppsView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/apps/create' },
  )

const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])
const nameInput = () => screen.getByPlaceholderText('AppsCreateView.form.namePlaceholder')
const repoInput = () => screen.getByPlaceholderText('AppsCreateView.form.repoPlaceholder')
const submitButton = () => screen.getByRole('button', { name: 'AppsCreateView.buttons.add' })
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement

const pickFile = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } })

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  global.URL.createObjectURL = vi.fn(() => 'blob:mocked-url')
  global.URL.revokeObjectURL = vi.fn()
})

describe('AddAppsView', () => {
  it('zeigt einen Fehler, wenn Pflichtfelder (Name, Repo) fehlen', async () => {
    renderView()
    await userEvent.click(submitButton())

    expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.missingFields'])
    expect(appApi.create).not.toHaveBeenCalled()
  })

  it('zeigt einen Fehler, wenn die Git-URL ein ungültiges Format hat', async () => {
    renderView()
    await userEvent.type(nameInput(), 'Meine App')
    await userEvent.type(repoInput(), 'keine-echte-url')
    await userEvent.click(submitButton())

    expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.invalidUrl'])
  })

  it('zeigt den Namen live in der Vorschau', async () => {
    renderView()
    expect(screen.getByText('AppsCreateView.preview.defaultName')).toBeInTheDocument()

    await userEvent.type(nameInput(), 'Kali Linux')

    expect(screen.getByRole('heading', { name: 'Kali Linux' })).toBeInTheDocument()
  })

  it('lehnt Dateien ab, die keine Bilder sind', () => {
    renderView()
    pickFile(new File(['text content'], 'test.txt', { type: 'text/plain' }))

    expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.onlyImages'])
  })

  it('lehnt Bilder ab, die größer als 2MB sind', () => {
    renderView()
    const huge = new File([''], 'huge.png', { type: 'image/png' })
    Object.defineProperty(huge, 'size', { value: 3 * 1024 * 1024 })
    pickFile(huge)

    expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.imageTooLarge'])
  })

  it('akzeptiert gültige Bilder, zeigt eine Vorschau und kann sie entfernen', async () => {
    renderView()
    pickFile(new File(['dummy'], 'logo.png', { type: 'image/png' }))

    const img = await screen.findByAltText('AppsCreateView.preview.logoAlt')
    expect(img).toHaveAttribute('src', 'blob:mocked-url')
    expect(screen.getByText('logo.png')).toBeInTheDocument()

    await userEvent.click(screen.getByText('AppsCreateView.form.logoRemove'))

    expect(screen.queryByAltText('AppsCreateView.preview.logoAlt')).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mocked-url')
  })

  it('sendet die Daten erfolgreich an die API und navigiert zur Liste', async () => {
    vi.mocked(appApi.create).mockResolvedValue({ data: {} } as any)
    renderView()

    await userEvent.type(nameInput(), 'Super App')
    await userEvent.type(screen.getByPlaceholderText('AppsCreateView.form.descPlaceholder'), 'Eine Testbeschreibung')
    await userEvent.type(repoInput(), 'https://github.com/user/repo')
    await userEvent.click(submitButton())

    await waitFor(() =>
      expect(appApi.create).toHaveBeenCalledWith({
        name: 'Super App',
        description: 'Eine Testbeschreibung',
        git_link: 'https://github.com/user/repo',
        image: null,
        is_private: false,
        submit_all_versions: false,
      }),
    )
    expect(toasts()).toContainEqual(['success', 'AppsCreateView.messages.success'])
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/apps'))
  })

  it('verbirgt "alle Versionen einreichen" für private Apps und sendet false', async () => {
    vi.mocked(appApi.create).mockResolvedValue({ data: {} } as any)
    renderView()

    await userEvent.click(screen.getByRole('switch'))
    await userEvent.click(screen.getByRole('button', { name: 'AppsCreateView.form.visibilityPrivate' }))
    expect(screen.queryByRole('switch')).not.toBeInTheDocument()

    await userEvent.type(nameInput(), 'Geheim')
    await userEvent.type(repoInput(), 'git@github.com:u/r.git')
    await userEvent.click(submitButton())

    await waitFor(() =>
      expect(appApi.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_private: true, submit_all_versions: false }),
      ),
    )
  })

  it('zeigt eine korrekte Fehlermeldung, wenn die API 403 zurückgibt', async () => {
    vi.mocked(appApi.create).mockRejectedValue({ response: { status: 403 } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderView()

    await userEvent.type(nameInput(), 'Super App')
    await userEvent.type(repoInput(), 'https://github.com/user/repo')
    await userEvent.click(submitButton())

    await waitFor(() => expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.noAccess']))
  })

  it('unterscheidet Server- und Netzwerkfehler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(appApi.create).mockRejectedValue(new Error('offline'))
    renderView()

    await userEvent.type(nameInput(), 'Super App')
    await userEvent.type(repoInput(), 'https://github.com/user/repo')
    await userEvent.click(submitButton())

    await waitFor(() => expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.networkError']))
  })
})
