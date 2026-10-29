import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import SummaryHero from '../SummaryHero'
import { renderWithProviders } from '../../../../tests/helpers/render'

function setup(over: Partial<React.ComponentProps<typeof SummaryHero>> = {}) {
  const onEdit = vi.fn()
  const view = renderWithProviders(
    <SummaryHero
      appName="windows-matlab-app"
      appImage={null}
      deploymentName="test"
      people={3}
      version="v2.1.0"
      runtime="kubevirt-vm"
      onEdit={onEdit}
      {...over}
    />,
    { realI18n: true },
  )
  return { onEdit, ...view }
}

describe('SummaryHero', () => {
  it('says in one sentence what the click on "Deployen" starts', () => {
    setup()
    expect(screen.getByRole('heading', { level: 2, name: 'windows-matlab-app für 3 Personen' })).toBeInTheDocument()
  })

  it('speaks of one person in the singular', () => {
    setup({ people: 1 })
    expect(screen.getByRole('heading', { level: 2, name: 'windows-matlab-app für 1 Person' })).toBeInTheDocument()
  })

  it('names the app as not found in the sentence when it is unknown', () => {
    setup({ appName: null })
    expect(screen.getByRole('heading', { level: 2, name: 'App nicht gefunden für 3 Personen' })).toBeInTheDocument()
  })

  it('shows the name of the deployment, with the name in bold, under the sentence', () => {
    setup({ deploymentName: 'Praktikum 2' })
    const line = screen.getByText(/Deployment „/)
    expect(line).toHaveTextContent('Deployment „Praktikum 2“')
    expect(within(line).getByText('Praktikum 2').tagName).toBe('STRONG')
  })

  it('never reads a name as markup', () => {
    setup({ deploymentName: '<img src=x onerror=alert(1)>' })
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(document.querySelector('img[onerror]')).toBeNull()
  })

  it('shows version and runtime as a name plate', () => {
    setup()
    const plate = screen.getByRole('group', { name: i18n.t('deployment.summary.hero.facts') })
    expect(within(plate).getByText('Version')).toBeInTheDocument()
    expect(within(plate).getByText('v2.1.0')).toBeInTheDocument()
    expect(within(plate).getByText('Laufzeit')).toBeInTheDocument()
    expect(within(plate).getByText(i18n.t('runtime.kubevirtVm'))).toBeInTheDocument()
  })

  it('shows pods for a pod app', () => {
    setup({ runtime: 'kubernetes' })
    expect(screen.getByText(i18n.t('runtime.kubernetes'))).toBeInTheDocument()
  })

  it('names the eyebrow "Das wird gestartet"', () => {
    setup()
    expect(screen.getByText('Das wird gestartet')).toBeInTheDocument()
  })

  it('is a region named by its sentence', () => {
    setup()
    expect(screen.getByRole('region', { name: 'windows-matlab-app für 3 Personen' })).toBeInTheDocument()
  })

  it('shows the image of the app when there is one, and an icon otherwise', () => {
    const { container, unmount } = setup({ appImage: 'data:image/png;base64,AAAA' })
    expect(container.querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAAA')
    // the sentence already names the app: the image is decoration
    expect(container.querySelector('img')).toHaveAttribute('alt', '')
    unmount()
    const { container: plain } = setup()
    expect(plain.querySelector('img')).toBeNull()
    expect(plain.querySelector('svg')).not.toBeNull()
  })

  it('leads to the first step from "Bearbeiten", which says where it leads', async () => {
    const { onEdit } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Name und Auswahl bearbeiten' }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })
})
