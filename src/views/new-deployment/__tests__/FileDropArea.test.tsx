import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import FileDropArea from '../FileDropArea'
import { renderWithProviders } from '../../../../tests/helpers/render'

const zip = () => new File(['x'], 'a.zip', { type: 'application/zip' })

function setup(over: Partial<React.ComponentProps<typeof FileDropArea>> = {}) {
  const onPick = vi.fn()
  const onDropFile = vi.fn()
  renderWithProviders(
    <FileDropArea title="ZIP-Datei hier ablegen" hint="Optional · gilt für alle 3 Studierenden" onPick={onPick} onDropFile={onDropFile} {...over} />,
  )
  return { onPick, onDropFile, area: screen.getByTestId('file-drop') }
}

describe('FileDropArea', () => {
  it('shows what to do and for whom, with a real button', () => {
    setup()
    expect(screen.getByText('ZIP-Datei hier ablegen')).toBeInTheDocument()
    expect(screen.getByText('Optional · gilt für alle 3 Studierenden')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'deployment.fileVariable.drop.pick' })).toBeInTheDocument()
  })

  it('opens the file dialog through the button', () => {
    const { onPick } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'deployment.fileVariable.drop.pick' }))
    expect(onPick).toHaveBeenCalledTimes(1)
  })

  it('passes a dropped file on and does not navigate away', () => {
    const { onDropFile, area } = setup()
    const file = zip()
    const ev = fireEvent.drop(area, { dataTransfer: { files: [file] } })
    expect(onDropFile).toHaveBeenCalledWith(file)
    expect(ev).toBe(false) // preventDefault was called
  })

  it('ignores a drop without files', () => {
    const { onDropFile, area } = setup()
    fireEvent.drop(area, { dataTransfer: { files: [] } })
    expect(onDropFile).not.toHaveBeenCalled()
  })

  it('highlights while a file is dragged over it and not afterwards', () => {
    const { area } = setup()
    expect(area).toHaveAttribute('data-dragging', 'false')
    fireEvent.dragOver(area, { dataTransfer: { files: [zip()] } })
    expect(area).toHaveAttribute('data-dragging', 'true')
    fireEvent.dragLeave(area)
    expect(area).toHaveAttribute('data-dragging', 'false')
    fireEvent.dragOver(area, { dataTransfer: { files: [zip()] } })
    fireEvent.drop(area, { dataTransfer: { files: [zip()] } })
    expect(area).toHaveAttribute('data-dragging', 'false')
  })

  it('hands the button to the caller so it can get the focus back', () => {
    const ref = { current: null as HTMLButtonElement | null }
    setup({
      pickRef: (el: HTMLButtonElement | null) => {
        ref.current = el
      },
    })
    expect(ref.current).toBe(screen.getByRole('button', { name: 'deployment.fileVariable.drop.pick' }))
  })
})
