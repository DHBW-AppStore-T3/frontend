import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import type { AppVariable, DeploymentFile } from '@/types'
import FileVariableCard from '../FileVariableCard'
import type { WizardTeam } from '../variableForm'
import { renderWithProviders } from '../../../../tests/helpers/render'

const KB = 1024
const teamOf = (n: number): WizardTeam[] =>
  Array.from({ length: n }, (_, i) => ({ name: `Team #${i + 1}`, members: [{ userId: `u${i}`, username: `user${i}` }] }))
const NAMES = ['Studentin Drei', 'Student Zwei', 'Student Vier', 'Anna Berger', 'Ben Köhler', 'Carla Weiß', 'David Roth', 'Elif Yilmaz', 'Felix Brandt', 'Greta Lang', 'Hannah Vogel', 'Ivo Schulz']
const nameOf = (id: string) => NAMES[Number(id.slice(1))] ?? id

const variable = (over: Partial<AppVariable> = {}): AppVariable => ({
  name: 'starter',
  type: 'string',
  osType: 'file',
  osScope: 'team',
  varScope: 'team',
  fileExtensions: ['zip'],
  required: false,
  ...over,
})

const sample = (name: string, size: number): DeploymentFile => ({ name, size, content_b64: `b64-${name}-${size}`, content_type: 'application/zip' })
const fileOf = (name: string, size: number) => {
  const f = new File(['x'], name, { type: 'application/zip' })
  Object.defineProperty(f, 'size', { value: size })
  return f
}

interface HarnessProps {
  variable?: AppVariable
  teams?: WizardTeam[]
  initial?: Record<string, DeploymentFile>
  otherBytes?: number
  onSet?: (varName: string, updates: Record<string, DeploymentFile | null>) => void
}

function Harness({ variable: v = variable(), teams = teamOf(3), initial = {}, otherBytes, onSet }: HarnessProps) {
  const [slots, setSlots] = useState<Record<string, DeploymentFile>>(initial)
  return (
    <FileVariableCard
      variable={v}
      teams={teams}
      nameOf={nameOf}
      otherBytes={otherBytes}
      getFileSlot={(_, slot) => slots[slot] ?? null}
      setFileSlots={(name, updates) => {
        onSet?.(name, updates)
        setSlots((cur) => {
          const next = { ...cur }
          for (const [slot, file] of Object.entries(updates)) {
            if (file === null) delete next[slot]
            else next[slot] = file
          }
          return next
        })
      }}
    />
  )
}

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement
const pickAll = () => fireEvent.click(screen.getAllByRole('button', { name: 'deployment.fileVariable.drop.pick' })[0]!)
async function dropAll(file: File) {
  fireEvent.drop(screen.getByTestId('file-drop'), { dataTransfer: { files: [file] } })
}
const radios = () => screen.getAllByRole('radio')

describe('FileVariableCard', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de')
  })

  describe('head', () => {
    it('shows the label of the app as title, a quiet "optional" and no technical type', () => {
      renderWithProviders(<Harness variable={variable({ label: 'Starter-Projekt' } as Partial<AppVariable>)} />)
      expect(screen.getByRole('heading', { name: 'Starter-Projekt' })).toBeInTheDocument()
      expect(screen.getByText('deployment.fileVariable.optional')).toBeInTheDocument()
      expect(screen.queryByText(/string/i)).toBeNull()
      expect(screen.queryByText('starter')).toBeNull()
    })

    it('derives a title from the name when the app has no label', () => {
      renderWithProviders(<Harness variable={variable({ name: 'assignments' })} />)
      expect(screen.getByRole('heading', { name: 'Assignments' })).toBeInTheDocument()
    })

    it('says "required" instead of "optional" for a required variable', () => {
      renderWithProviders(<Harness variable={variable({ required: true })} />)
      expect(screen.getByText('deployment.variables.required')).toBeInTheDocument()
      expect(screen.queryByText('deployment.fileVariable.optional')).toBeNull()
    })
  })

  describe('description', () => {
    const withDescription = variable({ description: 'Sie können jeder Person ein Startprojekt mitgeben.' })

    it('is closed by default and cannot be reached', () => {
      renderWithProviders(<Harness variable={withDescription} />)
      const toggle = screen.getByTestId('file-desc-toggle')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(toggle).toHaveTextContent('deployment.fileVariable.descShow')
      const panel = screen.getByTestId('file-desc')
      expect(panel).toHaveAttribute('inert')
      expect(toggle.getAttribute('aria-controls')).toBe(panel.id)
    })

    it('opens and closes with the mouse and changes its label', () => {
      renderWithProviders(<Harness variable={withDescription} />)
      const toggle = screen.getByTestId('file-desc-toggle')
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      expect(toggle).toHaveTextContent('deployment.fileVariable.descHide')
      expect(screen.getByTestId('file-desc')).not.toHaveAttribute('inert')
      expect(screen.getByText('Sie können jeder Person ein Startprojekt mitgeben.')).toBeInTheDocument()
      fireEvent.click(toggle)
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
    })

    it('works with Enter and Space, and keeps the focus on the button', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Harness variable={withDescription} />)
      const toggle = screen.getByTestId('file-desc-toggle')
      toggle.focus()
      await user.keyboard('{Enter}')
      expect(toggle).toHaveAttribute('aria-expanded', 'true')
      await user.keyboard(' ')
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(toggle).toHaveFocus()
    })

    it('has no button without a description, only the short line with the type', () => {
      renderWithProviders(<Harness />)
      expect(screen.queryByTestId('file-desc-toggle')).toBeNull()
      expect(screen.getByTestId('file-plain')).toBeInTheDocument()
    })

    it('does not show @expert markers of the app author', () => {
      renderWithProviders(<Harness variable={variable({ description: 'Nur für Profis @expert' })} />)
      fireEvent.click(screen.getByTestId('file-desc-toggle'))
      expect(screen.getByTestId('file-desc')).not.toHaveTextContent('@expert')
    })
  })

  describe('one file for everybody (default)', () => {
    it('starts with the drop area, "for all" selected and empty rings', () => {
      renderWithProviders(<Harness />)
      expect(radios()[0]).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByTestId('file-drop')).toBeInTheDocument()
      expect(screen.getAllByTestId('file-row').map((r) => r.dataset.has)).toEqual(['false', 'false', 'false'])
      expect(screen.queryByTestId('file-total')).toBeNull()
    })

    it('names the people, not "Team #1"', () => {
      renderWithProviders(<Harness />)
      expect(screen.getByText('Studentin Drei')).toBeInTheDocument()
      expect(screen.queryByText('Team #1')).toBeNull()
    })

    it('limits the file dialog to the extensions of the app', () => {
      renderWithProviders(<Harness />)
      expect(fileInput()).toHaveAttribute('accept', '.zip')
    })

    it('writes the same file to every slot in one go', async () => {
      const onSet = vi.fn()
      renderWithProviders(<Harness onSet={onSet} />)
      await dropAll(fileOf('starter.zip', 640 * KB))
      await waitFor(() => expect(onSet).toHaveBeenCalledTimes(1))
      const [name, updates] = onSet.mock.calls[0]!
      expect(name).toBe('starter')
      expect(Object.keys(updates)).toEqual(['Team #1', 'Team #2', 'Team #3'])
      expect(new Set(Object.values(updates).map((f) => (f as DeploymentFile).content_b64)).size).toBe(1)
    })

    it('shows the file as a card that says who gets it, and fills the rings', async () => {
      renderWithProviders(<Harness />, { realI18n: true })
      await dropAll(fileOf('starter.zip', 640 * KB))
      const card = await screen.findByTestId('file-card')
      expect(card).toHaveTextContent('starter.zip')
      expect(card).toHaveTextContent('640 KB')
      expect(card).toHaveTextContent('gilt für alle 3 Studierenden')
      expect(screen.getAllByTestId('file-row').map((r) => r.dataset.has)).toEqual(['true', 'true', 'true'])
      expect(screen.queryByTestId('file-drop')).toBeNull()
    })

    it('adds up the total and names the limit', async () => {
      renderWithProviders(<Harness />, { realI18n: true })
      await dropAll(fileOf('starter.zip', 640 * KB))
      const total = await screen.findByTestId('file-total')
      expect(total).toHaveTextContent('Zusammen 3 × 640 KB = 1,9 MB')
      expect(total).toHaveTextContent('höchstens 10 MB')
    })

    it('takes a file from the file dialog, too', async () => {
      const onSet = vi.fn()
      renderWithProviders(<Harness onSet={onSet} />)
      pickAll()
      fireEvent.change(fileInput(), { target: { files: [fileOf('starter.zip', 100)] } })
      await waitFor(() => expect(onSet).toHaveBeenCalled())
      expect(Object.keys(onSet.mock.calls[0]![1])).toHaveLength(3)
    })

    it('replaces the file everywhere', async () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('a.zip', 100), 'Team #3': sample('a.zip', 100) }} />, {
        realI18n: true,
      })
      fireEvent.click(screen.getByRole('button', { name: 'Ersetzen' }))
      fireEvent.change(fileInput(), { target: { files: [fileOf('b.zip', 200)] } })
      await waitFor(() => expect(screen.getByTestId('file-card')).toHaveTextContent('b.zip'))
    })

    it('removes the file everywhere and gives the focus back to "pick a file"', async () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('a.zip', 100), 'Team #3': sample('a.zip', 100) }} />, {
        realI18n: true,
      })
      fireEvent.click(screen.getByRole('button', { name: 'Entfernen' }))
      expect(screen.getByTestId('file-drop')).toBeInTheDocument()
      await waitFor(() => expect(screen.getByRole('button', { name: 'Datei auswählen' })).toHaveFocus())
    })

    it('says in plain words, for screen readers, what happened', async () => {
      renderWithProviders(<Harness />, { realI18n: true })
      await dropAll(fileOf('starter.zip', 640 * KB))
      await waitFor(() => expect(screen.getByTestId('file-live')).toHaveTextContent('starter.zip gilt jetzt für alle 3 Studierenden.'))
    })
  })

  describe('checks when the file is dropped', () => {
    it('rejects another type, also by drag and drop, and writes nothing', async () => {
      const onSet = vi.fn()
      renderWithProviders(<Harness onSet={onSet} />, { realI18n: true })
      await dropAll(fileOf('beispiel.pdf', 100))
      const err = await screen.findByRole('alert')
      expect(err).toHaveTextContent('„beispiel.pdf“ ist keine ZIP-Datei. Wählen Sie eine Datei mit der Endung .zip.')
      expect(onSet).not.toHaveBeenCalled()
    })

    it('rejects a file that is too large, without naming a limit', async () => {
      const onSet = vi.fn()
      renderWithProviders(<Harness onSet={onSet} />, { realI18n: true })
      await dropAll(fileOf('gross.zip', 1.6 * 1024 * KB))
      const err = await screen.findByRole('alert')
      expect(err).toHaveTextContent('„gross.zip“ ist zu groß. Verkleinern Sie die Datei oder wählen Sie eine andere.')
      expect(err.textContent).not.toMatch(/\d\s?MB/)
      expect(onSet).not.toHaveBeenCalled()
    })

    it('rejects a total that is too large, and says what would fit', async () => {
      renderWithProviders(<Harness teams={teamOf(12)} />, { realI18n: true })
      await dropAll(fileOf('a.zip', 880 * KB))
      const err = await screen.findByRole('alert')
      expect(err).toHaveTextContent('12 Personen × 880 KB = 10,3 MB. Zusammen sind höchstens 10 MB erlaubt.')
      expect(err).toHaveTextContent('Nehmen Sie eine Datei bis 853 KB')
    })

    it('counts the files of other variables against the total', async () => {
      renderWithProviders(<Harness otherBytes={8 * 1024 * KB} />, { realI18n: true })
      await dropAll(fileOf('a.zip', 900 * KB))
      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })

    it('can be dismissed and keeps the earlier choice', async () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('a.zip', 100), 'Team #3': sample('a.zip', 100) }} />, {
        realI18n: true,
      })
      fireEvent.click(screen.getByRole('button', { name: 'Ersetzen' }))
      fireEvent.change(fileInput(), { target: { files: [fileOf('x.pdf', 10)] } })
      const err = await screen.findByRole('alert')
      fireEvent.click(within(err).getByRole('button', { name: 'Meldung schließen' }))
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByTestId('file-card')).toHaveTextContent('a.zip')
    })

    it('announces the error as well', async () => {
      renderWithProviders(<Harness />, { realI18n: true })
      await dropAll(fileOf('x.pdf', 10))
      await waitFor(() => expect(screen.getByTestId('file-live')).toHaveTextContent('keine ZIP-Datei'))
    })
  })

  describe('one file per person', () => {
    const chooseEach = () => fireEvent.click(radios()[1]!)

    it('names the second choice after the recipients', () => {
      renderWithProviders(<Harness />, { realI18n: true })
      expect(radios()[0]).toHaveTextContent('Eine Datei für alle')
      expect(radios()[1]).toHaveTextContent('Pro Person unterschiedlich')
    })

    it('names the second choice after teams when teams have several people', () => {
      const teams: WizardTeam[] = [
        { name: 'Alpha', members: [{ userId: 'u0', username: 'a' }, { userId: 'u1', username: 'b' }] },
        { name: 'Beta', members: [{ userId: 'u2', username: 'c' }] },
      ]
      renderWithProviders(<Harness teams={teams} />, { realI18n: true })
      expect(radios()[1]).toHaveTextContent('Pro Team unterschiedlich')
    })

    it('keeps the files when switching, and offers a button per empty row', async () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('a.zip', 100), 'Team #3': sample('a.zip', 100) }} />, {
        realI18n: true,
      })
      chooseEach()
      expect(radios()[1]).toHaveAttribute('aria-checked', 'true')
      expect(screen.getAllByTestId('file-row').map((r) => r.dataset.has)).toEqual(['true', 'true', 'true'])
      expect(screen.queryByTestId('file-drop')).toBeNull()
    })

    it('replaces the file of one person only', async () => {
      const onSet = vi.fn()
      renderWithProviders(
        <Harness onSet={onSet} initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('a.zip', 100), 'Team #3': sample('a.zip', 100) }} />,
        { realI18n: true },
      )
      chooseEach()
      fireEvent.click(within(screen.getAllByTestId('file-row')[1]!).getByRole('button', { name: 'Ersetzen' }))
      fireEvent.change(fileInput(), { target: { files: [fileOf('b.zip', 200)] } })
      await waitFor(() => expect(onSet).toHaveBeenCalled())
      expect(onSet).toHaveBeenLastCalledWith('starter', { 'Team #2': expect.objectContaining({ name: 'b.zip' }) })
      expect(within(screen.getAllByTestId('file-row')[0]!).getByText('a.zip')).toBeInTheDocument()
    })

    it('takes a file dropped on a row and writes only that row', async () => {
      const onSet = vi.fn()
      renderWithProviders(<Harness onSet={onSet} />)
      chooseEach()
      fireEvent.drop(screen.getAllByTestId('file-row')[2]!, { dataTransfer: { files: [fileOf('c.zip', 50)] } })
      await waitFor(() => expect(onSet).toHaveBeenCalledTimes(1))
      expect(Object.keys(onSet.mock.calls[0]![1])).toEqual(['Team #3'])
    })

    it('removes one file, and all of them', async () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('b.zip', 100) }} />, { realI18n: true })
      expect(radios()[1]).toHaveAttribute('aria-checked', 'true') // mixed on entry
      fireEvent.click(screen.getByRole('button', { name: 'Datei für Studentin Drei entfernen' }))
      expect(screen.getAllByTestId('file-row').map((r) => r.dataset.has)).toEqual(['false', 'true', 'false'])
      fireEvent.click(screen.getByTestId('file-remove-all'))
      expect(screen.getAllByTestId('file-row').map((r) => r.dataset.has)).toEqual(['false', 'false', 'false'])
    })

    it('sums up the files in the list', () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100 * KB), 'Team #2': sample('b.zip', 200 * KB) }} />, { realI18n: true })
      const total = screen.getByTestId('file-total')
      expect(total).toHaveTextContent('2 Dateien')
      expect(total).toHaveTextContent('300 KB')
    })

    it('checks the total with the other people\'s files', async () => {
      const initial = Object.fromEntries(teamOf(12).slice(1).map((t) => [t.name, sample('big.zip', 900 * KB)]))
      renderWithProviders(<Harness teams={teamOf(12)} initial={initial} />, { realI18n: true })
      fireEvent.click(within(screen.getAllByTestId('file-row')[0]!).getByRole('button', { name: 'Datei auswählen' }))
      fireEvent.change(fileInput(), { target: { files: [fileOf('big.zip', 900 * KB)] } })
      expect(await screen.findByRole('alert')).toHaveTextContent('Mit dieser Datei wären es zusammen')
    })
  })

  describe('entering the step again', () => {
    it('is "for all" when every slot has the same file', () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('a.zip', 100), 'Team #3': sample('a.zip', 100) }} />)
      expect(radios()[0]).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByTestId('file-card')).toBeInTheDocument()
    })

    it('is "per person" when the files differ', () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('b.zip', 100), 'Team #3': sample('a.zip', 100) }} />)
      expect(radios()[1]).toHaveAttribute('aria-checked', 'true')
    })

    it('is "per person" when only some people have a file', () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100) }} />)
      expect(radios()[1]).toHaveAttribute('aria-checked', 'true')
    })

    it('tells that "for all" replaces the different files', () => {
      renderWithProviders(<Harness initial={{ 'Team #1': sample('a.zip', 100), 'Team #2': sample('b.zip', 100) }} />, { realI18n: true })
      fireEvent.click(radios()[0]!)
      expect(screen.getByTestId('file-mixed')).toHaveTextContent('Die Dateien sind je Person unterschiedlich. Eine neue Datei ersetzt sie alle.')
      expect(screen.getByTestId('file-drop')).toBeInTheDocument()
    })
  })

  describe('choice by keyboard', () => {
    it('is a radio group that the arrow keys operate', async () => {
      const user = userEvent.setup()
      renderWithProviders(<Harness />)
      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
      radios()[0]!.focus()
      await user.keyboard('{ArrowRight}')
      expect(radios()[1]).toHaveAttribute('aria-checked', 'true')
      expect(radios()[1]).toHaveFocus()
      await user.keyboard('{ArrowLeft}')
      expect(radios()[0]).toHaveAttribute('aria-checked', 'true')
    })

    it('puts only the chosen option in the tab order', () => {
      renderWithProviders(<Harness />)
      expect(radios().map((r) => r.getAttribute('tabindex'))).toEqual(['0', '-1'])
    })
  })

  describe('scopes', () => {
    it('has no choice and no list for a variable of the whole deployment', async () => {
      const onSet = vi.fn()
      renderWithProviders(<Harness variable={variable({ osScope: 'all', varScope: 'all' })} onSet={onSet} />, { realI18n: true })
      expect(screen.queryByRole('radiogroup')).toBeNull()
      expect(screen.queryByTestId('file-recipients')).toBeNull()
      expect(screen.getByTestId('file-drop')).toHaveTextContent('Optional · gilt für alle Studierenden')
      await dropAll(fileOf('a.zip', 10))
      await waitFor(() => expect(onSet).toHaveBeenCalledWith('starter', { all: expect.objectContaining({ name: 'a.zip' }) }))
    })

    it('has a row per member for a per-user variable', async () => {
      const teams: WizardTeam[] = [{ name: 'Alpha', members: [{ userId: 'u0', username: 'a' }, { userId: 'u1', username: 'b' }] }]
      const onSet = vi.fn()
      renderWithProviders(<Harness variable={variable({ osScope: 'user', varScope: 'user' })} teams={teams} onSet={onSet} />)
      expect(screen.getAllByTestId('file-row')).toHaveLength(2)
      await dropAll(fileOf('a.zip', 10))
      await waitFor(() => expect(onSet).toHaveBeenCalled())
      expect(Object.keys(onSet.mock.calls[0]![1])).toEqual(['Alpha-a', 'Alpha-b'])
    })

    it('talks about teams when teams have several people', () => {
      const teams: WizardTeam[] = [
        { name: 'Alpha', members: [{ userId: 'u0', username: 'a' }, { userId: 'u1', username: 'b' }] },
        { name: 'Beta', members: [{ userId: 'u2', username: 'c' }] },
      ]
      renderWithProviders(<Harness teams={teams} />, { realI18n: true })
      expect(screen.getByTestId('file-drop')).toHaveTextContent('gilt für alle 2 Teams')
      expect(screen.getByText('Studentin Drei, Student Zwei')).toBeInTheDocument()
    })

    it('says "the person" for exactly one person', () => {
      renderWithProviders(<Harness teams={teamOf(1)} />, { realI18n: true })
      expect(screen.getByText('Die Person bekommt die Datei.')).toBeInTheDocument()
    })
  })

  it('shows a calm hint and no drop area without teams', () => {
    renderWithProviders(<Harness teams={[]} />)
    expect(screen.getByText('deployment.variables.noTeamsConfigured')).toBeInTheDocument()
    expect(screen.queryByTestId('file-drop')).toBeNull()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('names the type of file in the drop area and in the short line', () => {
    renderWithProviders(<Harness />, { realI18n: true })
    expect(screen.getByTestId('file-drop')).toHaveTextContent('ZIP-Datei hier ablegen')
    expect(screen.getByTestId('file-plain')).toHaveTextContent('Eine ZIP-Datei.')
  })

  it('says just "file" for several or no extensions', () => {
    renderWithProviders(<Harness variable={variable({ fileExtensions: ['zip', 'tar'] })} />, { realI18n: true })
    expect(screen.getByTestId('file-drop')).toHaveTextContent('Datei hier ablegen')
    expect(screen.getByTestId('file-drop')).not.toHaveTextContent('ZIP')
  })
})
