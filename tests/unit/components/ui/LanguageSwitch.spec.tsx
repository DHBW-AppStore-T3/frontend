import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import LanguageSwitch from '@/components/ui/LanguageSwitch'

describe('LanguageSwitch', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('de')
  })

  it('marks the active language as pressed', () => {
    render(<LanguageSwitch />)
    expect(screen.getByRole('button', { name: 'DE' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the i18n language and persists the choice', async () => {
    render(<LanguageSwitch />)

    await userEvent.click(screen.getByRole('button', { name: 'EN' }))

    expect(i18n.language).toBe('en')
    expect(localStorage.getItem('locale')).toBe('en')
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-pressed', 'true')
  })
})
