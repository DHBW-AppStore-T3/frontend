import { describe, it, expect } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'
import BoldSlot from '../BoldSlot'

const i18n = i18next.createInstance()
void i18n.init({
  lng: 'en',
  resources: { en: { translation: { once: 'Delete {name}? It cannot be undone.', twice: '{name} and {name}', none: 'No slot' } } },
  interpolation: { prefix: '{', suffix: '}', escapeValue: false },
  showSupportNotice: false,
  initImmediate: false,
})

const renderSlot = (props: React.ComponentProps<typeof BoldSlot>) =>
  render(
    <I18nextProvider i18n={i18n}>
      <p data-testid="p">
        <BoldSlot {...props} />
      </p>
    </I18nextProvider>,
  ).getByTestId('p')

describe('BoldSlot', () => {
  it('shows the value in bold inside the message', () => {
    const p = renderSlot({ i18nKey: 'once', slot: 'name', value: 'Math' })

    expect(p.textContent).toBe('Delete Math? It cannot be undone.')
    expect(p.querySelector('strong')?.textContent).toBe('Math')
  })

  it('never turns the value into markup', () => {
    const p = renderSlot({ i18nKey: 'once', slot: 'name', value: '<img src=x onerror=alert(1)>' })

    expect(p.querySelector('img')).toBeNull()
    expect(p.querySelector('strong')?.textContent).toBe('<img src=x onerror=alert(1)>')
  })

  it('bolds every occurrence and tolerates a message without the slot', () => {
    expect(renderSlot({ i18nKey: 'twice', slot: 'name', value: 'A' }).querySelectorAll('strong')).toHaveLength(2)
    cleanup()
    expect(renderSlot({ i18nKey: 'none', slot: 'name', value: 'A' }).textContent).toBe('No slot')
  })
})
