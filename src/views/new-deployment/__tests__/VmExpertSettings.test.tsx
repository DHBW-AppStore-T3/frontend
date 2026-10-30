import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import VmExpertSettings from '../VmExpertSettings'
import { renderWithProviders } from '../../../../tests/helpers/render'

const choice = {
  container: 'vm',
  cpu: { default: '4', min: '2', max: '8' },
  memory: { default: '8Gi', min: '4Gi', max: '16Gi' },
}
const draft = {
  scope: 'user',
  studentIds: ['u1', 'u2'],
  groupNames: [],
  groupCount: 0,
  networkChoices: { internet: { default: true }, podNetwork: { default: false } },
  network: { internet: true, podNetwork: false },
} as any
const atDefault = { vm: { cpu: '4', memory: '8Gi' } }

function setup(over: { draft?: any; choices?: any[]; resources?: any; onResourcesChange?: any; onNetworkChange?: any } = {}) {
  return renderWithProviders(
    <VmExpertSettings
      draft={over.draft ?? draft}
      choices={over.choices ?? [choice]}
      resources={over.resources ?? atDefault}
      onResourcesChange={over.onResourcesChange ?? vi.fn()}
      onNetworkChange={over.onNetworkChange ?? vi.fn()}
    />,
  )
}
const head = () => screen.getByRole('button', { name: /deployment\.network\.title/ })
const pods = 'deployment.vm.pods.label'

describe('VmExpertSettings', () => {
  it('renders nothing without a resource choice and without networked desktops', () => {
    const { container } = setup({ choices: [], draft: { ...draft, networkChoices: { internet: { default: true } } } })
    expect(container).toBeEmptyDOMElement()
  })

  it('is closed by default: nothing inside can be reached', () => {
    setup()
    expect(head()).toHaveAttribute('aria-expanded', 'false')
    const body = screen.getByTestId('vm-expert-settings-body')
    expect(body).toHaveAttribute('aria-hidden', 'true')
    expect(body).toHaveAttribute('inert')
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
  })

  it('opens on a click and ties the button to its region', () => {
    setup()
    fireEvent.click(head())
    expect(head()).toHaveAttribute('aria-expanded', 'true')
    const body = screen.getByTestId('vm-expert-settings-body')
    expect(body).not.toHaveAttribute('inert')
    expect(body).not.toHaveAttribute('aria-hidden', 'true')
    expect(head().getAttribute('aria-controls')).toBe(body.id)
    expect(screen.getAllByRole('slider')).toHaveLength(2)
  })

  it('shows in the header what applies: the recommendation', () => {
    setup()
    expect(screen.getByTestId('vm-expert-chip')).toHaveTextContent('deployment.vm.expert.recommended')
    expect(screen.getByTestId('vm-expert-chip')).toHaveAttribute('data-changed', 'false')
    const plate = screen.getByTestId('vm-expert-plate')
    expect(plate).toHaveTextContent('4')
    expect(plate).toHaveTextContent('8')
  })

  it('shows in the header what applies: a customised choice', () => {
    setup({ resources: { vm: { cpu: '6', memory: '12Gi' } } })
    expect(screen.getByTestId('vm-expert-chip')).toHaveTextContent('deployment.vm.expert.changed')
    expect(screen.getByTestId('vm-expert-chip')).toHaveAttribute('data-changed', 'true')
    const plate = screen.getByTestId('vm-expert-plate')
    expect(plate).toHaveTextContent('6')
    expect(plate).toHaveTextContent('12')
  })

  it('lets the name of the button carry the summary, so closed means informed', () => {
    setup({ resources: { vm: { cpu: '6', memory: '12Gi' } } })
    expect(head().textContent).toContain('6')
    expect(head().textContent).toContain('12')
  })

  it('passes a change of the sliders on', () => {
    const onResourcesChange = vi.fn()
    setup({ onResourcesChange })
    fireEvent.click(head())
    fireEvent.change(screen.getAllByRole('slider')[0]!, { target: { value: '6000' } })
    expect(onResourcesChange).toHaveBeenCalledWith({ vm: { cpu: '6', memory: '8Gi' } })
  })

  it('offers networked desktops from two people on', () => {
    const onNetworkChange = vi.fn()
    setup({ onNetworkChange })
    fireEvent.click(head())
    const toggle = screen.getByRole('switch', { name: pods })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(onNetworkChange).toHaveBeenCalledWith({ internet: true, podNetwork: true })
  })

  it('hides networked desktops for a single person', () => {
    setup({ draft: { ...draft, studentIds: ['u1'] } })
    fireEvent.click(head())
    expect(screen.queryByRole('switch', { name: pods })).toBeNull()
    expect(screen.getAllByRole('slider')).toHaveLength(2)
  })

  it('never shows the internet switch: it has its own card', () => {
    setup()
    fireEvent.click(head())
    expect(screen.queryByRole('switch', { name: 'deployment.vm.internet.label' })).toBeNull()
  })

  it('works with networked desktops alone: no summary, no sliders', () => {
    setup({ choices: [], resources: {} })
    expect(screen.queryByTestId('vm-expert-chip')).toBeNull()
    fireEvent.click(head())
    expect(screen.getByRole('switch', { name: pods })).toBeInTheDocument()
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
  })

  it('works with the resource choice alone', () => {
    setup({ draft: { ...draft, networkChoices: {}, network: {} } })
    fireEvent.click(head())
    expect(screen.getAllByRole('slider')).toHaveLength(2)
    expect(screen.queryByRole('switch')).toBeNull()
  })

  it('counts people for the total only when every person gets a machine of their own', () => {
    setup()
    fireEvent.click(head())
    expect(screen.getByTestId('vm-total')).toBeInTheDocument()
  })

  it('shows no total when the app runs per team', () => {
    setup({ draft: { ...draft, scope: 'team', groupNames: ['A', 'B'], groupCount: 2 } })
    fireEvent.click(head())
    expect(screen.queryByTestId('vm-total')).toBeNull()
  })
})
