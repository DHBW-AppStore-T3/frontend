import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

import PodWorkloadsPanel from '@/components/PodWorkloadsPanel.vue'
import type { PodWorkload } from '@/types'

// Only the "Running" phase has a translation here; others fall back to
// the phase as Kubernetes names it.
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => (key === 'pods.phase.Running' ? 'Läuft' : key) }),
}))

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

type Props = InstanceType<typeof PodWorkloadsPanel>['$props']

const mountPanel = (props: Partial<Props> = {}) =>
  mount(PodWorkloadsPanel, {
    props: {
      workloads: [workload()],
      loading: false,
      error: null,
      live: true,
      canAct: true,
      busy: new Set<string>(),
      ...props,
    },
  })

describe('PodWorkloadsPanel.vue', () => {
  it('lists each workload with its team, state and restarts', () => {
    const wrapper = mountPanel({
      workloads: [workload(), workload({ workload: 'team-beta', team: 'Team Beta', ready: false, phase: 'CrashLoopBackOff', restarts: 4, lastEvent: 'Back-off restarting failed container' })],
    })

    const alpha = wrapper.get('[data-testid="workload-team-alpha"]')
    expect(alpha.text()).toContain('Team Alpha')
    expect(alpha.text()).toContain('Läuft')
    const beta = wrapper.get('[data-testid="workload-team-beta"]')
    expect(beta.text()).toContain('CrashLoopBackOff')
    expect(beta.text()).toContain('4')
    expect(beta.text()).toContain('Back-off restarting failed container')
  })

  it('links a workload\'s URL in a new tab without handing over the opener', () => {
    const link = mountPanel().get('[data-testid="workload-team-alpha"] a')

    expect(link.attributes('href')).toBe('https://lab.example/team-alpha/')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('emits restart and reset for the clicked workload', async () => {
    const wrapper = mountPanel()

    await wrapper.get('[data-testid="restart-team-alpha"]').trigger('click')
    await wrapper.get('[data-testid="reset-team-alpha"]').trigger('click')

    expect(wrapper.emitted('restart')).toEqual([['team-alpha']])
    expect(wrapper.emitted('reset')).toEqual([['team-alpha']])
  })

  it('has no actions without the right to act', () => {
    const wrapper = mountPanel({ canAct: false })

    expect(wrapper.find('[data-testid="restart-team-alpha"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="reset-team-alpha"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('pods.actions')
  })

  it('disables the actions of a workload with one in flight', () => {
    const wrapper = mountPanel({ busy: new Set(['team-alpha']) })

    expect(wrapper.get('[data-testid="restart-team-alpha"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="reset-team-alpha"]').attributes('disabled')).toBeDefined()
  })

  it('says so when the cluster could not be asked', () => {
    const wrapper = mountPanel({ workloads: [], live: false })

    expect(wrapper.text()).toContain('pods.notLive')
  })

  it('shows an error instead of the hints', () => {
    const wrapper = mountPanel({ workloads: [], error: 'cluster unreachable' })

    expect(wrapper.text()).toContain('cluster unreachable')
    expect(wrapper.text()).not.toContain('pods.none')
  })

  it('asks for a refresh', async () => {
    const wrapper = mountPanel()

    await wrapper.get('button[title="pods.refreshTooltip"]').trigger('click')

    expect(wrapper.emitted('refresh')).toHaveLength(1)
  })
})
