import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import i18n from '@/i18n'
import AppVersionStatusBadge from '@/components/ui/AppVersionStatusBadge'

const badge = (status: string) =>
  render(<AppVersionStatusBadge status={status as never} />).container.firstElementChild as HTMLElement

describe('AppVersionStatusBadge', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('de')
  })

  it.each([
    ['new', 'bg-surfaceMuted'],
    ['pending', 'bg-warningTint'],
    ['approved', 'bg-successTint'],
    ['published', 'bg-successTint'],
    ['rejected', 'bg-dangerTint'],
    ['private', 'bg-brandAccentSoft'],
  ])('maps %s to the matching Badge variant background', (status, expectedClass) => {
    expect(badge(status).className).toContain(expectedClass)
  })

  it('renders no raw Tailwind palette classes', () => {
    expect(badge('published').className).not.toMatch(/\b(green|red|blue|purple|yellow|gray)-\d/)
  })

  it('shows the translated label and a dash for unknown status', () => {
    expect(badge('pending').textContent).toBe(i18n.t('AppVersionStatusBadge.pending'))
    expect(badge('weird').textContent).toBe('-')
  })
})
