import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import i18n from '@/i18n'
import ScopeChoice from '../ScopeChoice'

describe('ScopeChoice', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de')
  })

  it('offers per person and per group and marks the current choice', () => {
    render(<ScopeChoice value="user" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: /Eine je Person/ })).toBeChecked()
    expect(screen.getByRole('radio', { name: /Eine je Gruppe/ })).not.toBeChecked()
  })

  it('reports the other choice', () => {
    const onChange = vi.fn()
    render(<ScopeChoice value="user" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: /Eine je Gruppe/ }))
    expect(onChange).toHaveBeenCalledWith('team')
  })
})
