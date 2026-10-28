// @vitest-environment jsdom
// EditAppModal renders MarkdownEditor, which sanitises through DOMPurify.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LogoPicker from '@/views/add-app/LogoPicker'
import EditAppModal from '@/views/app-detail/EditAppModal'
import { useToastStore } from '@/stores/toast.store'
import { renderWithProviders } from '../../helpers/render'

// Image upload by keyboard (#154, phase 1A). The picker used to be a clickable
// `div` around a `display: none` file input: not reachable by Tab, no name.
// Now the input is visually hidden but focusable, wrapped by the label that
// is also the click target, and named by the row label.

const noop = () => {}
const png = () => new File(['x'], 'logo.png', { type: 'image/png' })

const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement
/** The dashed drop target around the input, independent of how deep the label nests. */
const dropZone = () => fileInput().closest('[class*="border-dashed"]') as HTMLElement

/** Counts the clicks the input receives (= opening the native picker) without opening it. */
function watchPicker(input: HTMLInputElement) {
  const opened = vi.fn((e: Event) => e.preventDefault())
  input.addEventListener('click', opened)
  return opened
}

beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  global.URL.createObjectURL = vi.fn(() => 'blob:preview')
  global.URL.revokeObjectURL = vi.fn()
})

describe('LogoPicker', () => {
  const picker = (props: Partial<React.ComponentProps<typeof LogoPicker>> = {}) =>
    renderWithProviders(
      <>
        <span id="row-label">Logo der App</span>
        <LogoPicker file={null} onFile={noop} onRemove={noop} labelledBy="row-label" {...props} />
      </>,
    )

  describe('accessible name and focus', () => {
    it('names the file input by the row label', () => {
      picker()
      expect(screen.getByLabelText('Logo der App')).toBe(fileInput())
    })

    it('falls back to the select text when no row label is given', () => {
      picker({ labelledBy: undefined })
      expect(screen.getByLabelText('AppsCreateView.form.logoSelect')).toBe(fileInput())
    })

    it('keeps the input focusable: visually hidden, not display:none', () => {
      picker()
      expect(fileInput()).not.toHaveClass('hidden')
      expect(fileInput()).toHaveClass('sr-only')
    })

    it('is the first stop of the tab order', async () => {
      picker()
      await userEvent.tab()
      expect(fileInput()).toHaveFocus()
    })

    it('opens the file dialog on Enter and on Space', async () => {
      picker()
      const opened = watchPicker(fileInput())
      await userEvent.tab()
      await userEvent.keyboard('{Enter}')
      expect(opened).toHaveBeenCalledTimes(1)
      await userEvent.keyboard(' ')
      expect(opened).toHaveBeenCalledTimes(2)
    })

    it('opens the file dialog on a click on the visible text', async () => {
      picker()
      const opened = watchPicker(fileInput())
      await userEvent.click(screen.getByText('AppsCreateView.form.logoSelect'))
      expect(opened).toHaveBeenCalledTimes(1)
    })

    it('describes the input by the hint', () => {
      picker()
      expect(fileInput()).toHaveAccessibleDescription('AppsCreateView.form.logoSelect')
    })

    it('describes the input by the file name once one is chosen', () => {
      picker({ file: png() })
      expect(fileInput()).toHaveAccessibleDescription('logo.png')
    })
  })

  describe('behaviour that stays', () => {
    it('reports a picked file and resets the input value', () => {
      const onFile = vi.fn()
      picker({ onFile })
      fireEvent.change(fileInput(), { target: { files: [png()] } })
      expect(onFile).toHaveBeenCalledTimes(1)
      expect(onFile.mock.calls[0][0].name).toBe('logo.png')
      expect(fileInput().value).toBe('')
    })

    it('reports a dropped file and marks the zone while dragging', () => {
      const onFile = vi.fn()
      picker({ onFile })
      const zone = dropZone()
      fireEvent.dragOver(zone)
      expect(zone).toHaveClass('border-primary')
      fireEvent.drop(zone, { dataTransfer: { files: [png()] } })
      expect(zone).not.toHaveClass('border-primary')
      expect(onFile).toHaveBeenCalledTimes(1)
    })

    it('ignores a drop without files', () => {
      const onFile = vi.fn()
      picker({ onFile })
      fireEvent.drop(dropZone(), { dataTransfer: { files: [] } })
      expect(onFile).not.toHaveBeenCalled()
    })
  })

  describe('remove button', () => {
    it('is a separate button, not nested in the label or another button', () => {
      picker({ file: png() })
      const remove = screen.getByRole('button', { name: 'AppsCreateView.form.logoRemove' })
      expect(remove.closest('label')).toBeNull()
      expect(remove.parentElement?.closest('button')).toBeNull()
    })

    it('removes by mouse and keyboard without opening the file dialog', async () => {
      const onRemove = vi.fn()
      picker({ file: png(), onRemove })
      const opened = watchPicker(fileInput())
      const remove = screen.getByRole('button', { name: 'AppsCreateView.form.logoRemove' })

      await userEvent.click(remove)
      remove.focus()
      await userEvent.keyboard('{Enter}')
      await userEvent.keyboard(' ')

      expect(onRemove).toHaveBeenCalledTimes(3)
      expect(opened).not.toHaveBeenCalled()
    })

    it('is the second tab stop after the input', async () => {
      picker({ file: png() })
      await userEvent.tab()
      expect(fileInput()).toHaveFocus()
      await userEvent.tab()
      expect(screen.getByRole('button', { name: 'AppsCreateView.form.logoRemove' })).toHaveFocus()
    })
  })
})

// The modal fills its form when `show` turns true, so it is opened by a click.
function Harness(props: Omit<React.ComponentProps<typeof EditAppModal>, 'show'>) {
  const [show, setShow] = useState(false)
  return (
    <>
      <button onClick={() => setShow(true)}>open</button>
      <EditAppModal show={show} {...props} />
    </>
  )
}

async function openModal(over: Record<string, unknown> = {}, onSave = vi.fn()) {
  const app = { appId: 'a-1', name: 'Alt', description: 'Text', image: '', ...over } as never
  renderWithProviders(<Harness app={app} isSaving={false} onClose={noop} onSave={onSave} />)
  await userEvent.click(screen.getByRole('button', { name: 'open' }))
  return { dialog: screen.getByRole('dialog'), onSave }
}

describe('EditAppModal: image', () => {
  it('names the file input by the visible "Logo" label', async () => {
    const { dialog } = await openModal()
    expect(within(dialog).getByLabelText('AppsDetailView.editModal.imageLabel')).toBe(fileInput())
  })

  it('keeps the input focusable and reachable by Tab inside the dialog', async () => {
    await openModal()
    expect(fileInput()).not.toHaveClass('hidden')
    expect(fileInput()).toHaveClass('sr-only')
    // Tab order in the dialog: name, description editor controls, then the image input.
    let guard = 0
    while (document.activeElement !== fileInput() && guard++ < 30) await userEvent.tab()
    expect(fileInput()).toHaveFocus()
  })

  it('opens the file dialog on Enter and on Space', async () => {
    await openModal()
    const opened = watchPicker(fileInput())
    fileInput().focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(opened).toHaveBeenCalledTimes(2)
  })

  it('opens the file dialog on a click on the hint', async () => {
    await openModal()
    const opened = watchPicker(fileInput())
    await userEvent.click(screen.getByText('AppsDetailView.editModal.imageHint'))
    expect(opened).toHaveBeenCalledTimes(1)
  })

  it('describes the input by the hint', async () => {
    await openModal()
    expect(fileInput()).toHaveAccessibleDescription('AppsDetailView.editModal.imageHint')
  })

  it('shows the current image and describes the input by its caption', async () => {
    await openModal({ image: 'https://cdn/x.png' })
    expect(screen.getByRole('img', { name: 'Alt' })).toHaveAttribute('src', 'https://cdn/x.png')
    expect(fileInput()).toHaveAccessibleDescription('AppsDetailView.editModal.currentImage')
  })

  it('removes the image by mouse and keyboard; the button is not nested', async () => {
    const { onSave } = await openModal({ image: 'https://cdn/x.png' })
    const remove = screen.getByRole('button', { name: 'AppsDetailView.editModal.imageRemove' })
    expect(remove.closest('label')).toBeNull()
    const opened = watchPicker(fileInput())

    remove.focus()
    await userEvent.keyboard('{Enter}')

    expect(screen.queryByRole('img', { name: 'Alt' })).not.toBeInTheDocument()
    expect(opened).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'AppsDetailView.editModal.saveButton' }))
    expect(onSave).toHaveBeenCalledWith({ name: 'Alt', description: 'Text' }, 'remove')
  })

  it('previews a picked image and sends it on save', async () => {
    const { onSave } = await openModal()
    const file = png()
    fireEvent.change(fileInput(), { target: { files: [file] } })

    expect(await screen.findByRole('img', { name: 'Alt' })).toHaveAttribute('src', 'blob:preview')
    expect(screen.getByText('logo.png')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'AppsDetailView.editModal.saveButton' }))
    expect(onSave).toHaveBeenCalledWith({ name: 'Alt', description: 'Text' }, file)
  })

  it('describes the input by the chosen file name', async () => {
    await openModal()
    fireEvent.change(fileInput(), { target: { files: [png()] } })
    await screen.findByText('logo.png')
    expect(fileInput()).toHaveAccessibleDescription('logo.png')
  })

  it('accepts a dropped image', async () => {
    await openModal()
    const zone = dropZone()
    fireEvent.dragOver(zone)
    expect(zone.className).toContain('border-green-500')
    fireEvent.drop(zone, { dataTransfer: { files: [png()] } })
    expect(zone.className).not.toContain('border-green-500')
    expect(await screen.findByText('logo.png')).toBeInTheDocument()
  })

  it('rejects files that are not images, picked or dropped', async () => {
    await openModal()
    const text = new File(['x'], 'a.txt', { type: 'text/plain' })
    fireEvent.change(fileInput(), { target: { files: [text] } })
    fireEvent.drop(dropZone(), { dataTransfer: { files: [text] } })

    expect(toasts()).toEqual([
      ['error', 'AppsDetailView.toasts.onlyImages'],
      ['error', 'AppsDetailView.toasts.onlyImages'],
    ])
    expect(screen.queryByText('a.txt')).not.toBeInTheDocument()
  })

  it('rejects images over the size limit', async () => {
    await openModal()
    const big = new File(['x'], 'big.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 })
    fireEvent.change(fileInput(), { target: { files: [big] } })

    expect(toasts()).toEqual([['error', 'AppsDetailView.toasts.imageTooLarge']])
    expect(screen.queryByText('big.png')).not.toBeInTheDocument()
  })
})
