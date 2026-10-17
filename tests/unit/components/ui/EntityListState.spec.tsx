import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Inbox } from 'lucide-react'
import EntityListState from '@/components/ui/EntityListState'

describe('EntityListState', () => {
  it('shows the spinner and loading message while loading, even if empty', () => {
    render(
      <EntityListState isLoading isEmpty loadingMessage="Loading…" emptyMessage="Nothing">
        <p>content</p>
      </EntityListState>,
    )
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(screen.queryByText('Nothing')).not.toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('shows the empty state with icon, message and action', () => {
    const { container } = render(
      <EntityListState isEmpty icon={Inbox} emptyMessage="Nothing" emptyAction={<button>Create</button>}>
        <p>content</p>
      </EntityListState>,
    )
    expect(screen.getByText('Nothing')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(container.querySelector('svg')).not.toBeNull()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('renders children otherwise', () => {
    render(
      <EntityListState>
        <p>content</p>
      </EntityListState>,
    )
    expect(screen.getByText('content')).toBeInTheDocument()
  })
})
