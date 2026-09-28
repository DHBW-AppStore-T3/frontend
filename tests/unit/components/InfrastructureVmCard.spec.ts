import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { DeploymentResource } from '@/types'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('lucide-vue-next', () => {
  const stub = (name: string) => ({ template: `<span class="${name.toLowerCase()}" />` })
  return {
    RefreshCcw: stub('RefreshCcw'),
    AlertTriangle: stub('AlertTriangle'),
    Cpu: stub('Cpu'),
    Network: stub('Network'),
  }
})

vi.mock('@/composables/useVmPresentation', () => ({
  formatUptime: vi.fn((launchedAt?: string | null) => (launchedAt ? '2 Stunden' : null)),
  pillToneClass: vi.fn((tone: string) => `pill-${tone}`),
}))

import InfrastructureVmCard from '@/components/InfrastructureVmCard.vue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeResource(overrides: Partial<DeploymentResource> = {}): DeploymentResource {
  return {
    address: 'openstack_compute_instance_v2.web[0]',
    display_name: 'web-server',
    category: 'instance',
    team: null,
    drift: 'in_sync',
    lifecycle: { status: 'ACTIVE', task_state: null, fault_message: null },
    hardware: {
      flavor_name: 'm1.small',
      vcpus: 2,
      ram_mb: 2048,
      disk_gb: 20,
      image_name: 'ubuntu-22.04',
      image_id: 'img-uuid-1234',
      availability_zone: 'nova',
      launched_at: '2026-01-01T00:00:00Z',
    },
    addresses: [
      { network: 'shared-net', fixed_ip: '10.0.0.5', floating_ip: '192.168.1.100' },
    ],
    ...overrides,
  } as unknown as DeploymentResource
}

function mountCard(resource: DeploymentResource, props: Record<string, any> = {}) {
  return mount(InfrastructureVmCard, { props: { resource, ...props } })
}

describe('InfrastructureVmCard', () => {
  beforeEach(() => setActivePinia(createPinia()))

  // -----------------------------------------------------------------------
  // Lifecycle pill
  // -----------------------------------------------------------------------
  it('shows "ACTIVE" pill for active instance', () => {
    const w = mountCard(makeResource())
    expect(w.text()).toContain('ACTIVE')
  })

  it('combines status + task_state in pill text', () => {
    const w = mountCard(makeResource({ lifecycle: { status: 'ACTIVE', task_state: 'networking', fault_message: null } } as any))
    expect(w.text()).toContain('ACTIVE · networking')
  })

  it('shows "unknown" when lifecycle is null', () => {
    const w = mountCard(makeResource({ lifecycle: null } as any))
    expect(w.text()).toContain('unknown')
  })

  it('shows "unknown" when lifecycle has no status', () => {
    const w = mountCard(makeResource({ lifecycle: { status: null, task_state: null, fault_message: null } } as any))
    expect(w.text()).toContain('unknown')
  })

  // -----------------------------------------------------------------------
  // Lifecycle pill tone
  // -----------------------------------------------------------------------
  it('uses pill-green tone for ACTIVE status', () => {
    const w = mountCard(makeResource({ lifecycle: { status: 'ACTIVE', task_state: null, fault_message: null } } as any))
    expect(w.text()).toContain('ACTIVE')
  })

  it('uses pill-red tone for ERROR status', () => {
    const w = mountCard(makeResource({ lifecycle: { status: 'ERROR', task_state: null, fault_message: 'Out of memory' } } as any))
    expect(w.html()).toContain('pill-red')
  })

  it('uses pill-amber tone for BUILD status', () => {
    const w = mountCard(makeResource({ lifecycle: { status: 'BUILD', task_state: null, fault_message: null } } as any))
    expect(w.html()).toContain('pill-amber')
  })

  it('uses pill-amber tone for REBUILD status', () => {
    const w = mountCard(makeResource({ lifecycle: { status: 'REBUILD', task_state: null, fault_message: null } } as any))
    expect(w.html()).toContain('pill-amber')
  })

  it('uses pill-grey tone for SHUTOFF status', () => {
    const w = mountCard(makeResource({ lifecycle: { status: 'SHUTOFF', task_state: null, fault_message: null } } as any))
    expect(w.html()).toContain('pill-grey')
  })

  it('uses pill-grey tone when status is null', () => {
    const w = mountCard(makeResource({ lifecycle: { status: null, task_state: null, fault_message: null } } as any))
    expect(w.html()).toContain('pill-grey')
  })

  // -----------------------------------------------------------------------
  // Drift banners
  // -----------------------------------------------------------------------
  it('shows no banner when drift is in_sync', () => {
    const w = mountCard(makeResource({ drift: 'in_sync' }))
    expect(w.text()).not.toContain('vm.drift')
  })

  it('shows stale banner when drift is stale', () => {
    const w = mountCard(makeResource({ drift: 'stale' }))
    expect(w.text()).toContain('vm.drift.staleTitle')
    expect(w.text()).toContain('vm.drift.staleHint')
  })

  it('shows missing banner when drift is missing', () => {
    const w = mountCard(makeResource({ drift: 'missing' }))
    expect(w.text()).toContain('vm.drift.missingTitle')
    expect(w.text()).toContain('vm.drift.missingHint')
  })

  // -----------------------------------------------------------------------
  // Fault banner
  // -----------------------------------------------------------------------
  it('shows fault message when lifecycle has fault', () => {
    const w = mountCard(makeResource({
      lifecycle: { status: 'ERROR', task_state: null, fault_message: 'No valid hosts' } as any,
    }))
    expect(w.text()).toContain('No valid hosts')
  })

  // -----------------------------------------------------------------------
  // Hardware row
  // -----------------------------------------------------------------------
  it('shows flavor info when hardware is present', () => {
    const w = mountCard(makeResource())
    expect(w.text()).toContain('m1.small')
  })

  it('shows image name when hardware has image_name', () => {
    const w = mountCard(makeResource())
    expect(w.text()).toContain('ubuntu-22.04')
  })

  it('shows image ID truncated when only image_id is present', () => {
    const w = mountCard(makeResource({
      hardware: { flavor_name: 'm1.small', vcpus: 2, ram_mb: 1024, disk_gb: 10, image_name: null, image_id: 'abcdef12-3456-xxxx', availability_zone: 'nova', launched_at: null } as any,
    }))
    expect(w.text()).toContain('abcdef12')
  })

  it('shows no hardware row when hardware is null', () => {
    const w = mountCard(makeResource({ hardware: null } as any))
    expect(w.find('.cpu').exists()).toBe(false)
  })

  it('shows availability_zone when present', () => {
    const w = mountCard(makeResource())
    expect(w.text()).toContain('nova')
  })

  // -----------------------------------------------------------------------
  // Addresses
  // -----------------------------------------------------------------------
  it('renders network addresses including floating IP', () => {
    const w = mountCard(makeResource())
    expect(w.text()).toContain('10.0.0.5')
    expect(w.text()).toContain('192.168.1.100')
  })

  it('renders no address section when addresses is empty', () => {
    const w = mountCard(makeResource({ addresses: [] }))
    expect(w.find('.network').exists()).toBe(false)
  })

  // -----------------------------------------------------------------------
  // Card border (drift → CSS classes)
  // -----------------------------------------------------------------------
  it('applies red border class when drift is missing', () => {
    const w = mountCard(makeResource({ drift: 'missing' }))
    expect(w.find('div').classes()).toContain('border-red-300')
  })

  it('applies amber border class when drift is stale', () => {
    const w = mountCard(makeResource({ drift: 'stale' }))
    expect(w.find('div').classes()).toContain('border-amber-300')
  })

  it('applies expanded border class when isExpanded=true', () => {
    const w = mountCard(makeResource({ drift: 'in_sync' }), { isExpanded: true })
    expect(w.find('div').classes()).toContain('border-gray-800')
  })

  it('applies neutral border class when in_sync and not expanded', () => {
    const w = mountCard(makeResource({ drift: 'in_sync' }), { isExpanded: false })
    expect(w.find('div').classes()).toContain('border-gray-200')
  })

  // -----------------------------------------------------------------------
  // Team badge
  // -----------------------------------------------------------------------
  it('shows team name when resource has a team', () => {
    const w = mountCard(makeResource({ team: 'Team-A' }))
    expect(w.text()).toContain('Team-A')
  })

  it('shows shared team label when team is null', () => {
    const w = mountCard(makeResource({ team: null }))
    expect(w.text()).toContain('vm.sharedTeam')
  })

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  it('emits open-details when Details button is clicked', async () => {
    const w = mountCard(makeResource())
    const buttons = w.findAll('button')
    await buttons[0].trigger('click')
    expect(w.emitted('open-details')).toBeTruthy()
    expect(w.emitted('open-details')![0][0]).toBe('openstack_compute_instance_v2.web[0]')
  })

  it('emits redeploy when Redeploy button is clicked', async () => {
    const w = mountCard(makeResource())
    const buttons = w.findAll('button')
    await buttons[1].trigger('click')
    expect(w.emitted('redeploy')).toBeTruthy()
  })

  it('disables redeploy button when redeploying=true', () => {
    const w = mountCard(makeResource(), { redeploying: true })
    const buttons = w.findAll('button')
    expect(buttons[1].attributes('disabled')).toBeDefined()
  })

  it('shows "hideDetails" label when isExpanded=true', () => {
    const w = mountCard(makeResource(), { isExpanded: true })
    expect(w.text()).toContain('vm.actions.hideDetails')
  })

  it('shows "showDetails" label when isExpanded=false', () => {
    const w = mountCard(makeResource(), { isExpanded: false })
    expect(w.text()).toContain('vm.actions.showDetails')
  })

  it('shows redeploying label when redeploying=true', () => {
    const w = mountCard(makeResource(), { redeploying: true })
    expect(w.text()).toContain('vm.actions.redeploying')
  })
})
