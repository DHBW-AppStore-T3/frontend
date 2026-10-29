import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SummarySettings from '../SummarySettings'
import type { SettingsRow } from '../summaryRows'
import { renderWithProviders } from '../../../../tests/helpers/render'

const resources = (over: Partial<Extract<SettingsRow, { kind: 'resources' }>> = {}): SettingsRow => ({
  kind: 'resources',
  id: 'resources',
  label: 'Rechenressourcen',
  unit: 'desktop',
  cpu: 4,
  memoryGb: '8',
  changed: false,
  total: null,
  ...over,
})
const internet = (on: boolean, unit: 'pod' | 'desktop' = 'desktop'): SettingsRow => ({
  kind: 'network',
  id: 'network-internet',
  label: 'Internetzugriff',
  key: 'internet',
  on,
  unit,
})
const together = (on: boolean, unit: 'pod' | 'desktop' = 'desktop'): SettingsRow => ({
  kind: 'network',
  id: 'network-podNetwork',
  label: unit === 'desktop' ? 'Vernetzte Desktops' : 'Vernetzte Pods',
  key: 'podNetwork',
  on,
  unit,
})
const file = (state: Extract<SettingsRow, { kind: 'file' }>): SettingsRow => state
const base = { kind: 'file', id: 'file-starter', label: 'Starter-Projekt' } as const

function setup(rows: SettingsRow[]) {
  const onEdit = vi.fn()
  const view = renderWithProviders(<SummarySettings rows={rows} onEdit={onEdit} />, { realI18n: true })
  return { onEdit, ...view }
}

/** The text of the value cell that belongs to a label. */
const valueOf = (label: string) => {
  const term = screen.getByText(label, { selector: 'dt' })
  return term.nextElementSibling as HTMLElement
}

describe('SummarySettings', () => {
  it('renders nothing without rows: an app with nothing to set has no such card', () => {
    const { container } = setup([])
    expect(container).toBeEmptyDOMElement()
  })

  it('is a region "Variablen-Konfiguration" with a definition list, one term per row', () => {
    setup([resources(), internet(true), together(false)])
    expect(screen.getByRole('region', { name: /Variablen-Konfiguration/ })).toBeInTheDocument()
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Rechenressourcen', 'Internetzugriff', 'Vernetzte Desktops'])
    expect(screen.getAllByRole('definition')).toHaveLength(3)
  })

  it('leads to the variables from "Bearbeiten", which says where it leads', async () => {
    const { onEdit } = setup([internet(true)])
    await userEvent.click(screen.getByRole('button', { name: 'Variablen bearbeiten' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  describe('resources', () => {
    it('shows the recommended resources as a name plate with the chip "Empfohlen"', () => {
      setup([resources()])
      const cell = valueOf('Rechenressourcen')
      expect(cell).toHaveTextContent('4')
      expect(cell).toHaveTextContent('vCPU')
      expect(cell).toHaveTextContent('8')
      expect(cell).toHaveTextContent('GB RAM')
      expect(within(cell).getByText('Empfohlen')).toBeInTheDocument()
    })

    it('says "Angepasst" for changed resources', () => {
      setup([resources({ changed: true, cpu: 6, memoryGb: '12' })])
      expect(within(valueOf('Rechenressourcen')).getByText('Angepasst')).toBeInTheDocument()
      expect(within(valueOf('Rechenressourcen')).queryByText('Empfohlen')).not.toBeInTheDocument()
    })

    it('adds what everybody gets together when every person has an environment', () => {
      setup([resources({ total: { people: 3, cpu: 12, memoryGb: '24' } })])
      expect(valueOf('Rechenressourcen')).toHaveTextContent('je Desktop · insgesamt für 3 Personen: 12 vCPU · 24 GB RAM')
    })

    it('names a pod "je Umgebung"', () => {
      setup([resources({ unit: 'pod', total: { people: 2, cpu: 4, memoryGb: '4' } })])
      expect(valueOf('Rechenressourcen')).toHaveTextContent('je Umgebung · insgesamt für 2 Personen: 4 vCPU · 4 GB RAM')
    })

    it('says nothing about a sum when there is none', () => {
      setup([resources()])
      expect(valueOf('Rechenressourcen')).not.toHaveTextContent('insgesamt')
    })
  })

  describe('network', () => {
    it('says "Erlaubt" for internet access, with the warning that follows from it', () => {
      setup([internet(true)])
      const cell = valueOf('Internetzugriff')
      expect(within(cell).getByText('Erlaubt')).toBeInTheDocument()
      expect(cell).toHaveTextContent('Studierende können Server im Internet erreichen.')
    })

    it('says "Gesperrt" for blocked internet access, with what that means', () => {
      setup([internet(false)])
      const cell = valueOf('Internetzugriff')
      expect(within(cell).getByText('Gesperrt')).toBeInTheDocument()
      expect(cell).toHaveTextContent('Studierende arbeiten ohne Internetzugriff.')
    })

    it.each([
      [true, 'desktop', 'An', 'Die Desktops dieses Deployments können sich gegenseitig erreichen.'],
      [false, 'desktop', 'Aus', 'Die Desktops arbeiten getrennt voneinander.'],
      [true, 'pod', 'An', 'Die Umgebungen dieses Deployments können sich gegenseitig erreichen.'],
      [false, 'pod', 'Aus', 'Die Umgebungen arbeiten getrennt voneinander.'],
    ] as const)('says what networking (on: %s) means for a %s', (on, unit, state, sentence) => {
      setup([together(on, unit)])
      const cell = valueOf(unit === 'desktop' ? 'Vernetzte Desktops' : 'Vernetzte Pods')
      expect(within(cell).getByText(state)).toBeInTheDocument()
      expect(cell).toHaveTextContent(sentence)
    })

    it('does not rely on colour: the state is text', () => {
      setup([internet(true)])
      expect(screen.getByText('Erlaubt')).toHaveAttribute('data-on', 'true')
    })
  })

  describe('files', () => {
    it('says that no file was chosen', () => {
      setup([file({ ...base, state: 'none' })])
      expect(valueOf('Starter-Projekt')).toHaveTextContent('Keine Datei ausgewählt.')
    })

    it('names one file for everybody, with its size and for whom it is', () => {
      setup([file({ ...base, state: 'uniform', file: { name: 'starter.zip', size: 640 * 1024 }, people: 3 })])
      const cell = valueOf('Starter-Projekt')
      expect(cell).toHaveTextContent('starter.zip')
      expect(cell).toHaveTextContent('640 KB · gilt für alle 3 Personen')
    })

    it('says "für 1 Person" for a single person', () => {
      setup([file({ ...base, state: 'uniform', file: { name: 'a.zip', size: 1024 }, people: 1 })])
      expect(valueOf('Starter-Projekt')).toHaveTextContent('1 KB · gilt für 1 Person')
    })

    it('counts the files and their size when people got different ones, and lists who got which', () => {
      setup([
        file({
          ...base,
          state: 'each',
          count: 2,
          bytes: 1_992_294,
          recipients: [
            { id: 'a', name: 'Studentin Drei', file: { name: 'a.zip', size: 1024 } },
            { id: 'b', name: 'Student Zwei', file: { name: 'b.zip', size: 2048 } },
            { id: 'c', name: 'Student Vier', file: null },
          ],
        }),
      ])
      const cell = valueOf('Starter-Projekt')
      expect(cell).toHaveTextContent('2 Dateien · 1,9 MB')
      const rows = within(cell).getAllByRole('listitem')
      expect(rows).toHaveLength(3)
      expect(rows[0]).toHaveTextContent('Studentin Drei')
      expect(rows[0]).toHaveTextContent('a.zip')
      expect(rows[2]).toHaveTextContent('Student Vier')
      expect(rows[2]).toHaveTextContent('Keine Datei')
    })

    it('counts one file in the singular', () => {
      setup([
        file({
          ...base,
          state: 'each',
          count: 1,
          bytes: 1024,
          recipients: [{ id: 'a', name: 'Studentin Drei', file: { name: 'a.zip', size: 1024 } }, { id: 'b', name: 'Student Zwei', file: null }],
        }),
      ])
      expect(valueOf('Starter-Projekt')).toHaveTextContent('1 Datei · 1 KB')
    })
  })

  describe('values', () => {
    const value = (lines: Extract<SettingsRow, { kind: 'value' }>['lines']): SettingsRow => ({ kind: 'value', id: 'value-x', label: 'Region', lines })

    it('shows a value', () => {
      setup([value([{ slot: null, text: 'eu-west' }])])
      expect(valueOf('Region')).toHaveTextContent('eu-west')
    })

    it('shows a line per team for values that differ per team', () => {
      setup([value([{ slot: 'Team Alpha', text: 'a-db' }, { slot: 'Team Beta', text: 'b-db' }])])
      const items = within(valueOf('Region')).getAllByRole('listitem')
      expect(items.map((i) => i.textContent)).toEqual(['Team Alphaa-db', 'Team Betab-db'])
    })
  })

  it('keeps the order of the rows it gets', () => {
    setup([internet(true), resources(), together(true)])
    expect(screen.getAllByRole('term').map((t) => t.textContent)).toEqual(['Internetzugriff', 'Rechenressourcen', 'Vernetzte Desktops'])
  })
})
