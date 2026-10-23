import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'

import PodWorkloadsPanel, { phaseTone, type PodWorkloadsPanelProps } from '@/components/PodWorkloadsPanel'
import type { PodWorkload } from '@/types'

// Only the "Running" phase has a translation here; others fall back to the
// phase as Kubernetes names it.
const i18n = i18next.createInstance()
void i18n.init({
  lng: 'de',
  resources: { de: { translation: { pods: { phase: { Running: 'Läuft' } } } } },
  interpolation: { prefix: '{', suffix: '}', escapeValue: false },
  showSupportNotice: false,
  initImmediate: false,
})

const workload = (overrides: Partial<PodWorkload> = {}): PodWorkload => ({
  workload: 'team-alpha',
  team: 'Team Alpha',
  user_id: null,
  ready: true,
  restarts: 0,
  phase: 'Running',
  url: 'https://lab.example/team-alpha/',
  lastEvent: null,
  ...overrides,
})

function renderPanel(props: Partial<PodWorkloadsPanelProps> = {}) {
  const handlers = { onRefresh: vi.fn(), onRestart: vi.fn(), onReset: vi.fn() }
  render(
    <I18nextProvider i18n={i18n}>
      <PodWorkloadsPanel
        workloads={[workload()]}
        loading={false}
        error={null}
        live
        canAct
        busy={new Set()}
        {...handlers}
        {...props}
      />
    </I18nextProvider>,
  )
  return handlers
}

describe('PodWorkloadsPanel', () => {
  it('lists each workload with its team, state and restarts', () => {
    renderPanel({
      workloads: [
        workload(),
        workload({ workload: 'team-beta', team: 'Team Beta', ready: false, phase: 'CrashLoopBackOff', restarts: 4, lastEvent: 'Back-off restarting failed container' }),
      ],
    })

    const alpha = within(screen.getByTestId('workload-team-alpha'))
    expect(alpha.getByText('Team Alpha')).toBeInTheDocument()
    expect(alpha.getByText('Läuft')).toBeInTheDocument()
    const beta = within(screen.getByTestId('workload-team-beta'))
    expect(beta.getByText('CrashLoopBackOff')).toBeInTheDocument()
    expect(beta.getByText('4')).toBeInTheDocument()
    expect(beta.getByText('Back-off restarting failed container')).toBeInTheDocument()
  })

  it("links a workload's URL in a new tab without handing over the opener", () => {
    renderPanel()

    const link = within(screen.getByTestId('workload-team-alpha')).getByRole('link')
    expect(link).toHaveAttribute('href', 'https://lab.example/team-alpha/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('does not link an unsafe URL', () => {
    renderPanel({ workloads: [workload({ url: 'javascript:alert(1)' })] })

    expect(within(screen.getByTestId('workload-team-alpha')).queryByRole('link')).not.toBeInTheDocument()
  })

  it('reports restart and reset for the clicked workload', async () => {
    const { onRestart, onReset } = renderPanel()

    await userEvent.click(screen.getByTestId('restart-team-alpha'))
    await userEvent.click(screen.getByTestId('reset-team-alpha'))

    expect(onRestart).toHaveBeenCalledWith('team-alpha')
    expect(onReset).toHaveBeenCalledWith('team-alpha')
  })

  it('has no actions without the right to act', () => {
    renderPanel({ canAct: false })

    expect(screen.queryByTestId('restart-team-alpha')).not.toBeInTheDocument()
    expect(screen.queryByTestId('reset-team-alpha')).not.toBeInTheDocument()
    expect(screen.queryByText('pods.actions')).not.toBeInTheDocument()
  })

  it('disables the actions of a workload with one in flight', () => {
    renderPanel({ busy: new Set(['team-alpha']) })

    expect(screen.getByTestId('restart-team-alpha')).toBeDisabled()
    expect(screen.getByTestId('reset-team-alpha')).toBeDisabled()
  })

  it('says so when the cluster could not be asked', () => {
    renderPanel({ workloads: [], live: false })

    expect(screen.getByText('pods.notLive')).toBeInTheDocument()
  })

  it('shows an error instead of the hints', () => {
    renderPanel({ workloads: [], error: 'cluster unreachable' })

    expect(screen.getByText('cluster unreachable')).toBeInTheDocument()
    expect(screen.queryByText('pods.none')).not.toBeInTheDocument()
  })

  it('asks for a refresh', async () => {
    const { onRefresh } = renderPanel()

    await userEvent.click(screen.getByTitle('pods.refreshTooltip'))

    expect(onRefresh).toHaveBeenCalledTimes(1)
  })
})

describe('phaseTone', () => {
  it.each([
    [{ ready: true, phase: 'Running' }, 'green'],
    [{ ready: false, phase: 'Stopped' }, 'slate'],
    [{ ready: false, phase: 'Pending' }, 'yellow'],
    [{ ready: false, phase: 'ContainerCreating' }, 'yellow'],
    [{ ready: false, phase: 'CrashLoopBackOff' }, 'red'],
    [{ ready: false, phase: 'ImagePullBackOff' }, 'red'],
  ])('%j is %s', (workload, colour) => {
    expect(phaseTone(workload)).toContain(colour)
  })
})
