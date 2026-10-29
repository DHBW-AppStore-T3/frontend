import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import RecipientRail, { type RailItem } from '../RecipientRail'

const items: RailItem[] = [
  { id: 'a', name: 'Studentin Drei' },
  { id: 'b', name: 'Team Alpha', sub: 'Studentin Drei, Student Zwei', right: <span>2 Personen</span>, filled: true },
  { id: 'c', name: 'Student Vier', right: <span data-testid="right-c">starter.zip</span> },
]

describe('RecipientRail', () => {
  it('is an ordered list with one row per recipient, named for people', () => {
    render(<RecipientRail items={items} aria-label="Teilnehmende" />)

    const list = screen.getByRole('list', { name: 'Teilnehmende' })
    expect(list.tagName).toBe('OL')
    const rows = within(list).getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]!).getByText('Studentin Drei')).toBeInTheDocument()
  })

  it('shows the second line only where there is one', () => {
    render(<RecipientRail items={items} />)

    const [first, second] = screen.getAllByRole('listitem')
    expect(first!.querySelector('small')).toBeNull()
    expect(second!.querySelector('small')).toHaveTextContent('Studentin Drei, Student Zwei')
  })

  it('puts whatever the caller gives into the right column', () => {
    render(<RecipientRail items={items} />)

    expect(screen.getByText('2 Personen')).toBeInTheDocument()
    expect(screen.getByTestId('right-c')).toHaveTextContent('starter.zip')
  })

  it('marks which dots are filled, as text for tests and as the data attribute the style reads', () => {
    render(<RecipientRail items={items} />)

    expect(screen.getAllByRole('listitem').map((row) => row.getAttribute('data-has'))).toEqual(['false', 'true', 'false'])
  })

  it('hides the dot from screen readers: the name says it all', () => {
    const { container } = render(<RecipientRail items={items} />)

    const dots = container.querySelectorAll('.rail-node')
    expect(dots).toHaveLength(3)
    dots.forEach((dot) => expect(dot).toHaveAttribute('aria-hidden', 'true'))
  })

  it('lets the caller add attributes to a row (test ids, drag handlers, style)', () => {
    let dropped = ''
    render(
      <RecipientRail
        items={items}
        rowProps={(item, index) => ({
          'data-testid': 'row',
          'data-id': item.id,
          'data-index': String(index),
          onDrop: () => {
            dropped = item.id
          },
        })}
      />,
    )

    const rows = screen.getAllByTestId('row')
    expect(rows.map((r) => r.getAttribute('data-id'))).toEqual(['a', 'b', 'c'])
    expect(rows[2]).toHaveAttribute('data-index', '2')
    expect(rows[1]).toHaveClass('rail-row')
    rows[1]!.dispatchEvent(new Event('drop', { bubbles: true }))
    expect(dropped).toBe('b')
  })

  it('renders nothing but an empty list without recipients', () => {
    render(<RecipientRail items={[]} aria-label="leer" />)

    expect(screen.getByRole('list', { name: 'leer' })).toBeEmptyDOMElement()
  })
})
