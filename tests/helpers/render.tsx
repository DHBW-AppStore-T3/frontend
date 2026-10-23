import type { ReactElement } from 'react'
import { render, type RenderResult } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { I18nextProvider } from 'react-i18next'
import i18next, { type i18n as I18n } from 'i18next'
import appI18n from '@/i18n'

let keyEcho: I18n | null = null

/**
 * i18n instance without messages: `t('some.key')` returns `'some.key'`.
 * Lets specs assert on translation keys independent of locale copy.
 */
export function keyEchoI18n(): I18n {
  if (!keyEcho) {
    keyEcho = i18next.createInstance()
    void keyEcho.init({
      lng: 'de',
      resources: {},
      interpolation: { prefix: '{', suffix: '}', escapeValue: false },
      showSupportNotice: false,
      initImmediate: false,
    })
  }
  return keyEcho
}

export interface ProviderOptions {
  /** Initial URL for the MemoryRouter. */
  route?: string
  /** Use the real app i18n (actual de/en copy) instead of key echoing. */
  realI18n?: boolean
}

/** Render with a MemoryRouter and an i18n provider. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', realI18n = false }: ProviderOptions = {},
): RenderResult {
  const i18n = realI18n ? appI18n : keyEchoI18n()
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </I18nextProvider>,
  )
}
