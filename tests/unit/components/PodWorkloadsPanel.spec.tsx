import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'

import PodWorkloadsPanel, { displayPhase, phaseTone, type PodWorkloadsPanelProps } from '@/components/PodWorkloadsPanel'
import type { PodWorkload } from '@/types'

// Only a few phases have a translation here; others fall back to the phase
// as Kubernetes names it.
const i18n = i18next.createInstance()
void i18n.init({
  lng: 'de',
  resources: {
    de: {
      translation: {
        pods: {
          phase: { Running: 'Läuft', Starting: 'startet', NotResponding: 'antwortet nicht' },
          started: 'App erfolgreich gestartet',
          setup: {
            title: 'Einrichtung',
            etaUnknown: 'Restzeit wird geschätzt',
            etaSoon: 'gleich fertig',
            etaMinutes: 'noch ca. {minutes} Min',
            etaHours: 'noch ca. {hours} Std {minutes} Min',
          },
        },
      },
    },
  },
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
    // Runs, its app does not answer yet: starting, not failed.
    [{ ready: false, phase: 'Starting' }, 'yellow'],
    [{ ready: false, phase: 'Running' }, 'yellow'],
    [{ ready: false, phase: 'PodInitializing' }, 'yellow'],
    // Stopped answering, or never did within the deploy's time.
    [{ ready: false, phase: 'NotResponding' }, 'red'],
  ])('%j is %s', (workload, colour) => {
    expect(phaseTone(workload)).toContain(colour)
  })

  it('shows a running pod that is not ready as starting (older backend)', () => {
    expect(displayPhase({ ready: false, phase: 'Running' })).toBe('Starting')
    expect(displayPhase({ ready: true, phase: 'Running' })).toBe('Running')
  })
})

describe('PodWorkloadsPanel: starting and not responding', () => {
  it('labels a pod whose app does not answer yet as starting, not as running', () => {
    renderPanel({ workloads: [workload({ ready: false, phase: 'Running', lastEvent: null })] })
    const badge = within(screen.getByTestId('workload-team-alpha')).getByText('startet')
    expect(badge.className).toContain('yellow')
    expect(screen.queryByText('Läuft')).not.toBeInTheDocument()
  })

  it('labels a pod that stopped answering as not responding and shows why', () => {
    renderPanel({
      workloads: [
        workload({
          ready: false,
          phase: 'NotResponding',
          lastEvent: 'Unhealthy: Readiness probe failed: dial tcp 10.0.0.7:8080: connect: connection refused',
        }),
      ],
    })
    const row = screen.getByTestId('workload-team-alpha')
    expect(within(row).getByText('antwortet nicht').className).toContain('red')
    expect(within(row).getByText(/Readiness probe failed/)).toBeInTheDocument()
  })
})


describe('PodWorkloadsPanel: started and setup', () => {
  it('shows "app started successfully" instead of an old warning once the workload is ready', () => {
    renderPanel({ workloads: [workload({ ready: true, lastEvent: 'Unhealthy: Readiness probe failed: dial tcp' })] })
    expect(screen.getByTestId('started-team-alpha')).toHaveTextContent('App erfolgreich gestartet')
    expect(screen.queryByText(/Readiness probe failed/)).not.toBeInTheDocument()
  })

  it('shows the last event while the workload is not ready', () => {
    renderPanel({ workloads: [workload({ ready: false, phase: 'Pending', lastEvent: 'Pulling: image' })] })
    expect(screen.getByText('Pulling: image')).toBeInTheDocument()
    expect(screen.queryByTestId('started-team-alpha')).not.toBeInTheDocument()
  })

  it('shows a second bar with percent and the remaining time while the app sets itself up', () => {
    renderPanel({ workloads: [workload({ setup: { percent: 37, step: 'MATLAB wird installiert', etaSeconds: 900 } })] })
    const bar = screen.getByRole('progressbar', { name: 'Einrichtung' })
    expect(bar).toHaveAttribute('aria-valuenow', '37')
    expect(screen.getByTestId('setup-team-alpha')).toHaveTextContent('37 % · noch ca. 15 Min')
    expect(screen.getByTestId('setup-team-alpha')).toHaveTextContent('MATLAB wird installiert')
  })

  it.each([
    [undefined, 'Restzeit wird geschätzt'],
    [null, 'Restzeit wird geschätzt'],
    [20, 'gleich fertig'],
    [3900, 'noch ca. 1 Std 5 Min'],
  ])('describes an estimate of %s seconds', (eta, text) => {
    renderPanel({ workloads: [workload({ setup: { percent: 5, etaSeconds: eta as number | null | undefined } })] })
    expect(screen.getByTestId('setup-team-alpha')).toHaveTextContent(text)
  })

  it('shows no setup bar for an app without a setup', () => {
    renderPanel()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
