import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BaseButton from '@/components/ui/BaseButton'

describe('BaseButton', () => {
  it('defaults to the primary variant', () => {
    render(<BaseButton>Go</BaseButton>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveClass('bg-brandAccentSoft')
  })

  it('renders the secondary variant', () => {
    render(<BaseButton variant="secondary">Go</BaseButton>)
    expect(screen.getByRole('button').className).toContain('bg-primarySoft')
  })

  it('renders the outline variant', () => {
    render(<BaseButton variant="outline">Go</BaseButton>)
    const classes = screen.getByRole('button').className
    expect(classes).toContain('border')
    expect(classes).toContain('bg-transparent')
  })

  it('renders the text variant', () => {
    render(<BaseButton variant="text">Go</BaseButton>)
    const classes = screen.getByRole('button').className
    expect(classes).toContain('bg-transparent')
    expect(classes).not.toContain('border')
  })

  it('renders the destructive variant', () => {
    render(<BaseButton variant="destructive">Go</BaseButton>)
    expect(screen.getByRole('button').className).toContain('bg-destructiveSoft')
  })

  it('renders the solid variant as a pill', () => {
    render(<BaseButton variant="solid">Go</BaseButton>)
    const classes = screen.getByRole('button').className
    expect(classes).toContain('bg-primary')
    expect(classes).toContain('rounded-full')
  })

  it('forwards native attributes and click handlers, merging className', async () => {
    const onClick = vi.fn()
    render(
      <BaseButton type="submit" className="extra" onClick={onClick}>
        Go
      </BaseButton>,
    )
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toHaveClass('extra')
    expect(button).toHaveClass('ui-button--primary')

    await userEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not fire clicks when disabled', async () => {
    const onClick = vi.fn()
    render(
      <BaseButton disabled onClick={onClick}>
        Go
      </BaseButton>,
    )
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })
})
