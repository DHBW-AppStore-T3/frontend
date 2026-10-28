import { describe, it, expect, afterEach } from 'vitest'
import { useState } from 'react'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '@/components/ui/Modal'
import Drawer from '@/components/ui/Drawer'
import AppSidebar from '@/layouts/AppSidebar'
import i18n from '@/i18n'
import { renderWithProviders } from '../../../helpers/render'

// Dialog semantics and keyboard operation of Modal and Drawer (#140), run
// against the real de/en copy.

const show = (ui: React.ReactElement) => renderWithProviders(ui, { realI18n: true })

async function useLocale(locale: 'de' | 'en') {
  await act(async () => {
    await i18n.changeLanguage(locale)
  })
}

afterEach(async () => {
  await useLocale('de')
  document.body.style.overflow = ''
})

describe('Modal: dialog semantics', () => {
  it('is a modal dialog named by its title', () => {
    show(<Modal show onClose={() => {}} title="Kurs löschen" />)
    const dialog = screen.getByRole('dialog', { name: 'Kurs löschen' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('takes its name from a heading passed as header', () => {
    show(<Modal show onClose={() => {}} header={<h2>Neuer Kurs</h2>} />)
    const dialog = screen.getByRole('dialog', { name: 'Neuer Kurs' })
    expect(within(dialog).getByRole('heading', { name: 'Neuer Kurs' })).toBeInTheDocument()
  })

  it('takes its name from composed header content', () => {
    show(<Modal show onClose={() => {}} title={<span className="x">Freigabe ablehnen</span>} />)
    expect(screen.getByRole('dialog', { name: 'Freigabe ablehnen' })).toBeInTheDocument()
  })

  it('lets header win over title for the name, as it does for the display', () => {
    show(<Modal show onClose={() => {}} header="Kopf" title="Titel" />)
    expect(screen.getByRole('dialog', { name: 'Kopf' })).toBeInTheDocument()
  })

  it('references the visible title element through aria-labelledby', () => {
    show(<Modal show onClose={() => {}} title="Sichtbar" />)
    const dialog = screen.getByRole('dialog')
    const id = dialog.getAttribute('aria-labelledby')
    expect(id).toBeTruthy()
    expect(document.getElementById(id!)).toHaveTextContent('Sichtbar')
  })

  it('gives every open modal its own label id', () => {
    show(
      <>
        <Modal show onClose={() => {}} title="Eins" />
        <Modal show onClose={() => {}} title="Zwei" />
      </>,
    )
    const [a, b] = screen.getAllByRole('dialog')
    expect(a!.getAttribute('aria-labelledby')).not.toBe(b!.getAttribute('aria-labelledby'))
    expect(screen.getByRole('dialog', { name: 'Eins' })).toBeInTheDocument()
    expect(screen.getByRole('dialog', { name: 'Zwei' })).toBeInTheDocument()
  })

  it('localises the close button and the fallback title (de)', async () => {
    await useLocale('de')
    show(<Modal show onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeInTheDocument()
  })

  it('localises the close button and the fallback title (en)', async () => {
    await useLocale('en')
    show(<Modal show onClose={() => {}} />)
    expect(screen.getByRole('dialog', { name: 'Modal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('is not in the accessibility tree while closed or after closing', async () => {
    function Host() {
      const [open, setOpen] = useState(true)
      return <Modal show={open} onClose={() => setOpen(false)} title="T" />
    }
    show(<Host />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    show(<Modal show={false} onClose={() => {}} title="Zu" />)
    expect(screen.queryByRole('dialog', { name: 'Zu' })).not.toBeInTheDocument()
  })
})

describe('Modal: keyboard operation as a dialog', () => {
  function Host({ onClose }: { onClose?: () => void }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Öffnen</button>
        <Modal
          show={open}
          onClose={() => {
            onClose?.()
            setOpen(false)
          }}
          title="Eingabe"
          footer={<button>Speichern</button>}
        >
          <input aria-label="Name" />
        </Modal>
      </>
    )
  }

  it('moves focus into the dialog, cycles Tab and Shift+Tab inside it, and gives focus back', async () => {
    const user = userEvent.setup()
    show(<Host />)
    const opener = screen.getByRole('button', { name: 'Öffnen' })
    await user.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Eingabe' })
    const close = within(dialog).getByRole('button', { name: 'Schließen' })
    const save = within(dialog).getByRole('button', { name: 'Speichern' })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    expect(document.activeElement).toBe(close)

    await user.tab()
    expect(document.activeElement).toBe(within(dialog).getByRole('textbox', { name: 'Name' }))
    await user.tab()
    expect(document.activeElement).toBe(save)
    await user.tab()
    expect(document.activeElement).toBe(close)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(save)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('closes through the close button and returns focus', async () => {
    const user = userEvent.setup()
    let closed = 0
    show(<Host onClose={() => closed++} />)
    const opener = screen.getByRole('button', { name: 'Öffnen' })
    await user.click(opener)
    await user.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(closed).toBe(1)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })
})

describe('Drawer: dialog semantics', () => {
  it('is a modal dialog named by the caller', () => {
    show(
      <Drawer show onClose={() => {}} label="Hauptmenü">
        <a href="#x">Start</a>
      </Drawer>,
    )
    const dialog = screen.getByRole('dialog', { name: 'Hauptmenü' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).not.toHaveAttribute('aria-labelledby')
  })

  it('prefers labelledBy over label', () => {
    show(
      <Drawer show onClose={() => {}} label="ignoriert" labelledBy="drawer-heading">
        <h2 id="drawer-heading">Sichtbare Überschrift</h2>
      </Drawer>,
    )
    expect(screen.getByRole('dialog', { name: 'Sichtbare Überschrift' })).toBeInTheDocument()
    expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-label')
  })

  it('keeps working without a label, with a localised generic name', async () => {
    await useLocale('de')
    const first = show(<Drawer show onClose={() => {}}>x</Drawer>)
    expect(screen.getByRole('dialog', { name: 'Seitenbereich' })).toBeInTheDocument()
    first.unmount()

    await useLocale('en')
    show(<Drawer show onClose={() => {}}>x</Drawer>)
    expect(screen.getByRole('dialog', { name: 'Side panel' })).toBeInTheDocument()
  })

  it('is not in the accessibility tree while closed', () => {
    show(<Drawer show={false} onClose={() => {}} label="Menü">x</Drawer>)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('cycles Tab inside and closes on Escape', async () => {
    const user = userEvent.setup()
    let closed = 0
    show(
      <Drawer show onClose={() => closed++} label="Menü">
        <a href="#a">A</a>
        <a href="#b">B</a>
      </Drawer>,
    )
    const a = screen.getByRole('link', { name: 'A' })
    const b = screen.getByRole('link', { name: 'B' })
    expect(document.activeElement).toBe(a)
    await user.tab()
    expect(document.activeElement).toBe(b)
    await user.tab()
    expect(document.activeElement).toBe(a)
    await user.keyboard('{Escape}')
    expect(closed).toBe(1)
  })

  it('keeps focus on the dialog and traps Tab when it has nothing focusable', async () => {
    const user = userEvent.setup()
    show(<Drawer show onClose={() => {}} label="Leer" />)
    const dialog = screen.getByRole('dialog', { name: 'Leer' })
    expect(document.activeElement).toBe(dialog)
    await user.tab()
    expect(document.activeElement).toBe(dialog)
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(dialog)
  })
})

describe('AppSidebar: mobile drawer name', () => {
  it('names the mobile navigation dialog in both languages', async () => {
    const width = window.innerWidth
    window.innerWidth = 400
    try {
      await useLocale('de')
      const first = show(
        <AppSidebar collapsed={false} navItems={[]} mobileOpen onCollapsedChange={() => {}} onCloseMobile={() => {}} />,
      )
      expect(screen.getByRole('dialog', { name: 'Navigationsmenü' })).toBeInTheDocument()
      first.unmount()

      await useLocale('en')
      show(<AppSidebar collapsed={false} navItems={[]} mobileOpen onCollapsedChange={() => {}} onCloseMobile={() => {}} />)
      expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument()
    } finally {
      window.innerWidth = width
    }
  })
})
