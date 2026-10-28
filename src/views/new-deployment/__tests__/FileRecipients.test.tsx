import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import type { DeploymentFile } from '@/types'
import FileRecipients from '../FileRecipients'
import { renderWithProviders } from '../../../../tests/helpers/render'

const rowsOf = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Person ${i + 1}` }))
const zip = (name = 'starter.zip', size = 640 * 1024): DeploymentFile => ({
  name,
  size,
  content_b64: 'eA==',
  content_type: 'application/zip',
})

function setup(over: Partial<React.ComponentProps<typeof FileRecipients>> = {}, real = false) {
  const handlers = {
    onPick: vi.fn(),
    onDropFile: vi.fn(),
    onRemove: vi.fn(),
    onRemoveAll: vi.fn(),
  }
  renderWithProviders(
    <FileRecipients rows={rowsOf(3)} files={{}} mode="all" kind="person" popIds={[]} {...handlers} {...over} />,
    { realI18n: real },
  )
  return handlers
}
const rows = () => screen.getAllByTestId('file-row')

describe('FileRecipients', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de')
  })

  it('shows a filled dot for people with a file and an empty ring for the others', () => {
    setup({ files: { p0: zip(), p2: zip() } })
    expect(rows().map((r) => r.dataset.has)).toEqual(['true', 'false', 'true'])
  })

  it('says "no file" in words, so colour alone carries nothing', () => {
    setup({ files: { p0: zip() } })
    expect(within(rows()[1]!).getByText('deployment.fileVariable.recipients.none')).toBeInTheDocument()
    expect(within(rows()[0]!).getByText('starter.zip')).toBeInTheDocument()
  })

  it('shows names and, for teams, the members underneath', () => {
    setup({ rows: [{ id: 'A', name: 'Alpha', sub: 'Anna, Ben' }], kind: 'team' })
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Anna, Ben')).toBeInTheDocument()
  })

  it('titles the list by what it is', () => {
    setup()
    expect(screen.getByText('deployment.fileVariable.recipients.title')).toBeInTheDocument()
  })

  it('has no per-row actions when one file goes to everybody', () => {
    setup({ files: { p0: zip() } })
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  it('shows everybody up to five people', () => {
    setup({ rows: rowsOf(5) })
    expect(rows()).toHaveLength(5)
    expect(screen.queryByTestId('file-more')).toBeNull()
  })

  it('shortens a long list to three rows and offers the rest', () => {
    setup({ rows: rowsOf(12) }, true)
    expect(rows()).toHaveLength(3)
    expect(screen.getByTestId('file-more')).toHaveTextContent('9 weitere Personen anzeigen')
    fireEvent.click(screen.getByTestId('file-more'))
    expect(rows()).toHaveLength(12)
    expect(screen.getByTestId('file-less')).toHaveTextContent('Weniger anzeigen')
    fireEvent.click(screen.getByTestId('file-less'))
    expect(rows()).toHaveLength(3)
  })

  it('counts teams as teams', () => {
    setup({ rows: rowsOf(8), kind: 'team' }, true)
    expect(screen.getByTestId('file-more')).toHaveTextContent('5 weitere Teams anzeigen')
  })

  describe('one file per person', () => {
    it('shows every row and a title that says so', () => {
      setup({ rows: rowsOf(12), mode: 'each' }, true)
      expect(rows()).toHaveLength(12)
      expect(screen.getByText('Dateien je Person')).toBeInTheDocument()
    })

    it('names teams in the title', () => {
      setup({ mode: 'each', kind: 'team' }, true)
      expect(screen.getByText('Dateien je Team')).toBeInTheDocument()
    })

    it('offers "pick a file" where nobody has one yet, with the name of the row', () => {
      const h = setup({ mode: 'each' })
      fireEvent.click(within(rows()[1]!).getByRole('button', { name: 'deployment.fileVariable.drop.pick' }))
      expect(h.onPick).toHaveBeenCalledWith('p1')
    })

    it('shows the file as a chip with replace and remove', () => {
      const h = setup({ mode: 'each', files: { p0: zip('a.zip', 640 * 1024) } }, true)
      const row = rows()[0]!
      expect(within(row).getByText('a.zip')).toBeInTheDocument()
      expect(within(row).getByText('640 KB')).toBeInTheDocument()
      fireEvent.click(within(row).getByRole('button', { name: 'Ersetzen' }))
      expect(h.onPick).toHaveBeenCalledWith('p0')
      fireEvent.click(within(row).getByRole('button', { name: 'Datei für Person 1 entfernen' }))
      expect(h.onRemove).toHaveBeenCalledWith('p0')
    })

    it('removes all files at once, only when there are some', () => {
      const none = setup({ mode: 'each' })
      expect(screen.queryByTestId('file-remove-all')).toBeNull()
      expect(none.onRemoveAll).not.toHaveBeenCalled()
    })

    it('removes all files on request', () => {
      const h = setup({ mode: 'each', files: { p0: zip() } })
      fireEvent.click(screen.getByTestId('file-remove-all'))
      expect(h.onRemoveAll).toHaveBeenCalledTimes(1)
    })

    it('takes a file dropped on a row', () => {
      const h = setup({ mode: 'each' })
      const file = new File(['x'], 'a.zip')
      fireEvent.drop(rows()[2]!, { dataTransfer: { files: [file] } })
      expect(h.onDropFile).toHaveBeenCalledWith('p2', file)
    })

    it('highlights the row a file is dragged over', () => {
      setup({ mode: 'each' })
      fireEvent.dragOver(rows()[0]!, { dataTransfer: { files: [new File(['x'], 'a.zip')] } })
      expect(rows()[0]).toHaveAttribute('data-dragging', 'true')
      fireEvent.dragLeave(rows()[0]!)
      expect(rows()[0]).toHaveAttribute('data-dragging', 'false')
    })
  })

  it('does not take drops on a row when one file goes to everybody', () => {
    const h = setup({ mode: 'all' })
    fireEvent.drop(rows()[0]!, { dataTransfer: { files: [new File(['x'], 'a.zip')] } })
    expect(h.onDropFile).not.toHaveBeenCalled()
  })

  it('marks the rows that just received a file, for the filling animation', () => {
    setup({ files: { p0: zip(), p1: zip() }, popIds: ['p0', 'p1'] })
    expect(rows().map((r) => r.dataset.pop)).toEqual(['true', 'true', 'false'])
  })
})
