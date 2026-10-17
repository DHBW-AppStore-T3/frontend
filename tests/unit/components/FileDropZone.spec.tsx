import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FileDropZone from '@/components/FileDropZone'
import { renderWithProviders } from '../../helpers/render'

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement
const pdf = (size?: number) => {
  const f = new File(['hello'], 'task.pdf', { type: 'application/pdf' })
  if (size !== undefined) Object.defineProperty(f, 'size', { value: size })
  return f
}

describe('FileDropZone', () => {
  it('shows the pick hint, label and size limit in the empty state', () => {
    renderWithProviders(<FileDropZone label="Team 1" maxBytes={3 * 1024 * 1024} onChange={() => {}} />)
    expect(screen.getByText(/Team 1:/)).toBeInTheDocument()
    expect(screen.getByText('fileDropZone.pick')).toBeInTheDocument()
    expect(screen.getByText('max. 3 MB')).toBeInTheDocument()
  })

  it('encodes a picked file as bare base64 and reports it', async () => {
    const onChange = vi.fn()
    renderWithProviders(<FileDropZone onChange={onChange} />)

    fireEvent.change(fileInput(), { target: { files: [pdf()] } })

    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange).toHaveBeenCalledWith({
      name: 'task.pdf',
      content_b64: btoa('hello'),
      size: 5,
      content_type: 'application/pdf',
    })
  })

  it('falls back to application/octet-stream for unknown types', async () => {
    const onChange = vi.fn()
    renderWithProviders(<FileDropZone onChange={onChange} />)

    fireEvent.change(fileInput(), { target: { files: [new File(['x'], 'blob')] } })

    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(onChange.mock.calls[0]![0].content_type).toBe('application/octet-stream')
  })

  it('rejects oversized files with an inline and a reported error', async () => {
    const onChange = vi.fn()
    const onError = vi.fn()
    renderWithProviders(<FileDropZone maxBytes={1024} onChange={onChange} onError={onError} />)

    fireEvent.change(fileInput(), { target: { files: [pdf(2048)] } })

    expect(await screen.findByText('fileDropZone.tooLarge')).toBeInTheDocument()
    expect(onError).toHaveBeenCalledWith('fileDropZone.tooLarge')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts a dropped file', async () => {
    const onChange = vi.fn()
    const { container } = renderWithProviders(<FileDropZone onChange={onChange} />)

    fireEvent.drop(container.firstElementChild!.firstElementChild as HTMLElement, {
      dataTransfer: { files: [pdf()] },
    })

    await waitFor(() => expect(onChange).toHaveBeenCalled())
  })

  it('renders the selected file and clears it on remove', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <FileDropZone
        value={{ name: 'data.csv', content_b64: 'x', size: 2048, content_type: 'text/csv' }}
        onChange={onChange}
      />,
    )
    expect(screen.getByText('data.csv')).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('fileDropZone.remove'))

    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('hides remove and ignores picks when disabled', () => {
    const onChange = vi.fn()
    const { unmount } = renderWithProviders(
      <FileDropZone
        disabled
        value={{ name: 'data.csv', content_b64: 'x', size: 1, content_type: 'text/csv' }}
        onChange={onChange}
      />,
    )
    expect(screen.queryByTitle('fileDropZone.remove')).not.toBeInTheDocument()
    unmount()

    renderWithProviders(<FileDropZone disabled onChange={onChange} />)
    fireEvent.change(fileInput(), { target: { files: [pdf()] } })
    expect(onChange).not.toHaveBeenCalled()
  })
})
