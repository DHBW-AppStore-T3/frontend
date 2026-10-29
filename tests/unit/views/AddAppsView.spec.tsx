// @vitest-environment jsdom
// MarkdownEditor/Renderer sanitise through DOMPurify, which needs a spec-complete DOM.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent, within } from '@testing-library/react'
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

// Every keystroke re-renders the markdown preview (DOMPurify in jsdom), so typing
// a URL char by char costs seconds and can run into the 5 s test timeout on a
// loaded machine. A paste sets the same value with one input event; the test
// that checks the live preview still types.
const fill = async (el: HTMLElement, text: string) => {
  await userEvent.click(el)
  await userEvent.paste(text)
}

const pickFile = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } })

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
  global.URL.createObjectURL = vi.fn(() => 'blob:mocked-url')
  global.URL.revokeObjectURL = vi.fn()
})

describe('AddAppsView', () => {
  describe('Sichtbarkeit (#154)', () => {
    const group = () => screen.getByRole('group', { name: 'AppsCreateView.form.visibilityLabel' })
    const option = (key: string) =>
      within(group()).getByRole('button', { name: `AppsCreateView.form.${key}` })

    it('ist eine benannte Gruppe mit genau zwei Optionen', () => {
      renderView()
      expect(within(group()).getAllByRole('button')).toHaveLength(2)
    })

    it('zeigt den Zustand: Öffentlich ist vorgewählt', () => {
      renderView()
      expect(option('visibilityPublic')).toHaveAttribute('aria-pressed', 'true')
      expect(option('visibilityPrivate')).toHaveAttribute('aria-pressed', 'false')
    })

    it('wechselt Zustand, Hinweistext und abhängigen Schalter per Klick', async () => {
      renderView()
      expect(screen.getByText('AppsCreateView.form.visibilityPublicHint')).toBeInTheDocument()
      expect(screen.getByRole('switch')).toBeInTheDocument()

      await userEvent.click(option('visibilityPrivate'))

      expect(option('visibilityPrivate')).toHaveAttribute('aria-pressed', 'true')
      expect(option('visibilityPublic')).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByText('AppsCreateView.form.visibilityPrivateHint')).toBeInTheDocument()
      expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    })

    it('lässt sich per Tab, Enter und Leertaste bedienen', async () => {
      renderView()
      option('visibilityPublic').focus()
      await userEvent.tab()
      expect(option('visibilityPrivate')).toHaveFocus()

      await userEvent.keyboard('{Enter}')
      expect(option('visibilityPrivate')).toHaveAttribute('aria-pressed', 'true')

      await userEvent.tab({ shift: true })
      expect(option('visibilityPublic')).toHaveFocus()
      await userEvent.keyboard(' ')
      expect(option('visibilityPublic')).toHaveAttribute('aria-pressed', 'true')
      expect(option('visibilityPrivate')).toHaveAttribute('aria-pressed', 'false')
    })

    it('sendet is_private passend zur Auswahl, auch nach dem Zurückwechseln', async () => {
      vi.mocked(appApi.create).mockResolvedValue({ data: {} } as any)
      renderView()
      await fill(nameInput(), 'App')
      await fill(repoInput(), 'https://github.com/u/r')

      // By name only: this test records the payload and must hold on the old markup too.
      await userEvent.click(screen.getByRole('button', { name: 'AppsCreateView.form.visibilityPrivate' }))
      await userEvent.click(screen.getByRole('button', { name: 'AppsCreateView.form.visibilityPublic' }))
      await userEvent.click(submitButton())

      await waitFor(() =>
        expect(appApi.create).toHaveBeenCalledWith(expect.objectContaining({ is_private: false })),
      )
    })
  })

  it('benennt den Logo-Upload über die Zeilenbeschriftung (#154)', () => {
    renderView()
    expect(screen.getByLabelText('AppsCreateView.form.logoLabel')).toBe(fileInput())
    expect(fileInput()).not.toHaveClass('hidden')
  })

  it('names name, description and repo fields by their row labels (#141)', () => {
    renderView()
    expect(screen.getByRole('textbox', { name: 'AppsCreateView.form.nameLabel' })).toBe(nameInput())
    expect(screen.getByRole('textbox', { name: 'AppsCreateView.form.descLabel' })).toBe(
      screen.getByPlaceholderText('AppsCreateView.form.descPlaceholder'),
    )
    expect(screen.getByRole('textbox', { name: 'AppsCreateView.form.repoLabel' })).toBe(repoInput())
  })

  it('describes the description field by its Markdown hint (#141)', () => {
    renderView()
    expect(screen.getByRole('textbox', { name: 'AppsCreateView.form.descLabel' })).toHaveAccessibleDescription(
      'AppsCreateView.form.descMarkdownHint',
    )
  })

  it('zeigt einen Fehler, wenn Pflichtfelder (Name, Repo) fehlen', async () => {
    renderView()
    await userEvent.click(submitButton())

    expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.missingFields'])
    expect(appApi.create).not.toHaveBeenCalled()
  })

  it('zeigt einen Fehler, wenn die Git-URL ein ungültiges Format hat', async () => {
    renderView()
    await fill(nameInput(), 'Meine App')
    await fill(repoInput(), 'keine-echte-url')
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

    await fill(nameInput(), 'Super App')
    await fill(screen.getByPlaceholderText('AppsCreateView.form.descPlaceholder'), 'Eine Testbeschreibung')
    await fill(repoInput(), 'https://github.com/user/repo')
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

    await fill(nameInput(), 'Geheim')
    await fill(repoInput(), 'git@github.com:u/r.git')
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

    await fill(nameInput(), 'Super App')
    await fill(repoInput(), 'https://github.com/user/repo')
    await userEvent.click(submitButton())

    await waitFor(() => expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.noAccess']))
  })

  it('unterscheidet Server- und Netzwerkfehler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(appApi.create).mockRejectedValue(new Error('offline'))
    renderView()

    await fill(nameInput(), 'Super App')
    await fill(repoInput(), 'https://github.com/user/repo')
    await userEvent.click(submitButton())

    await waitFor(() => expect(toasts()).toContainEqual(['error', 'AppsCreateView.messages.networkError']))
  })
})
