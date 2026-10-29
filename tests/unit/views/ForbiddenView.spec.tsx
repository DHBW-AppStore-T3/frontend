import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'
import ForbiddenView from '@/views/ForbiddenView'
import i18n from '@/i18n'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>
}

const renderView = () =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/forbidden" element={<ForbiddenView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route: '/forbidden', realI18n: true },
  )

describe('ForbiddenView', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('de')
  })

  it('renders the access-denied message', () => {
    renderView()
    expect(screen.getByText(de.ForbiddenView.title)).toBeInTheDocument()
    expect(screen.getByText(de.ForbiddenView.description)).toBeInTheDocument()
  })

  it('renders in english when locale is en', async () => {
    await i18n.changeLanguage('en')
    renderView()
    expect(screen.getByText(en.ForbiddenView.title)).toBeInTheDocument()
  })

  it('navigates back to the dashboard on click', async () => {
    renderView()
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByTestId('where')).toHaveTextContent('/dashboard')
  })
})
