import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BaseInput from '@/components/ui/BaseInput'

describe('BaseInput', () => {
  it('uses the primaryAction token for the focus ring, not a hardcoded blue', () => {
    render(<BaseInput value="" onChange={() => {}} />)
    const classes = screen.getByRole('textbox').className
    expect(classes).toContain('focus:ring-primaryAction')
    expect(classes).toContain('focus:border-primaryAction')
    expect(classes).not.toContain('blue-500')
  })

  it('defaults to type text and renders placeholder and value', () => {
    render(<BaseInput value="abc" placeholder="Name" onChange={() => {}} />)
    const input = screen.getByPlaceholderText('Name')
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveValue('abc')
  })

  it('reports the new string value through onChange', async () => {
    const onChange = vi.fn()
    render(<BaseInput value="" onChange={onChange} />)

    await userEvent.type(screen.getByRole('textbox'), 'a')

    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('honours a custom type', () => {
    render(<BaseInput type="password" value="" onChange={() => {}} placeholder="pw" />)
    expect(screen.getByPlaceholderText('pw')).toHaveAttribute('type', 'password')
  })
})
