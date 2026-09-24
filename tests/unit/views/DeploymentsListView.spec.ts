import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'

import DeploymentsListView from '@/views/DeploymentsListView.vue'

// ---------------------------------------------------------------
// These tests were `describe.skip` from 2026-06-29 until this rewrite.
// The TODO on them said the view had been rebuilt onto PageHeader +
// EntityListState + Card, which broke their selectors -- not their
// subject. That is the tell: they asserted on markup, not behaviour.
//
// `getStatusColor` was checked by reading Tailwind classes off
// `.capitalize`; the loading state by looking for a stubbed icon's
// class. Renaming a utility class or swapping an icon broke a test
// about deployment status.
//
// The rewrite asserts what the page promises a user: which data it
// fetches, what text it shows, where its links point, and in what
// order the list comes out. None of that moves when the layout does.
// Status colour is intentionally not covered -- it is a lookup table
// with no branching worth a test, and pinning it to class names is
// exactly what made these brittle.
// ---------------------------------------------------------------

let mockDeployments: any[] = []
let mockDeploymentsLoading = false
let mockApps: any[] = []

const mockFetchDeployments = vi.fn()
const mockFetchApps = vi.fn()

vi.mock('@/stores/deployment.store', () => ({
  useDeploymentStore: () => ({
    get deployments() { return mockDeployments },
    get isLoading() { return mockDeploymentsLoading },
    fetchDeployments: mockFetchDeployments,
  }),
}))

vi.mock('@/stores/app.store', () => ({
  useAppStore: () => ({
    get apps() { return mockApps },
    fetchApps: mockFetchApps,
  }),
}))

const deployment = (over: Record<string, unknown> = {}) => ({
  deploymentId: 'dep-1',
  appId: 'app-123',
  name: 'Dep 1',
  status: 'success',
  releaseTag: 'v1',
  created_at: '2026-06-08T15:30:00Z',
  ...over,
})

const mountView = () =>
  mount(DeploymentsListView, {
    global: {
      mocks: {
        $t: (key: string, vars?: any) => (vars ? `${key} ${JSON.stringify(vars)}` : key),
      },
      stubs: { RouterLink: RouterLinkStub },
    },
  })

describe('DeploymentsListView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeployments = []
    mockDeploymentsLoading = false
    mockApps = []
  })

  it('fetches deployments and apps on mount', async () => {
    mountView()
    await flushPromises()

    expect(mockFetchDeployments).toHaveBeenCalledTimes(1)
    expect(mockFetchApps).toHaveBeenCalledTimes(1)
  })

  it('shows each deployment with the name of the app it came from', () => {
    mockDeployments = [deployment({ name: 'Mein Deployment' })]
    mockApps = [{ appId: 'app-123', name: 'Mein Backend' }]

    const text = mountView().text()

    expect(text).toContain('Mein Deployment')
    expect(text).toContain('Mein Backend')
  })

  it('falls back to a dash when the deployment references an unknown app', () => {
    mockDeployments = [deployment({ appId: 'does-not-exist' })]
    mockApps = []

    expect(mountView().text()).toContain('-')
  })

  it('renders the creation timestamp as a local date', () => {
    mockDeployments = [deployment({ created_at: '2026-06-08T15:30:00Z' })]

    expect(mountView().text()).toContain('08.06.2026')
  })

  it('orders deployments newest first regardless of server order', () => {
    // The server returns DB insert order; the view sorts client-side.
    mockDeployments = [
      deployment({ deploymentId: 'a', name: 'Oldest', created_at: '2026-01-01T00:00:00Z' }),
      deployment({ deploymentId: 'c', name: 'Newest', created_at: '2026-12-01T00:00:00Z' }),
      deployment({ deploymentId: 'b', name: 'Middle', created_at: '2026-06-01T00:00:00Z' }),
    ]

    const rendered = mountView().text()

    expect(rendered.indexOf('Newest')).toBeLessThan(rendered.indexOf('Middle'))
    expect(rendered.indexOf('Middle')).toBeLessThan(rendered.indexOf('Oldest'))
  })

  it('sorts deployments without a timestamp to the end', () => {
    mockDeployments = [
      deployment({ deploymentId: 'a', name: 'NoDate', created_at: null }),
      deployment({ deploymentId: 'b', name: 'Dated', created_at: '2026-06-01T00:00:00Z' }),
    ]

    const rendered = mountView().text()

    expect(rendered.indexOf('Dated')).toBeLessThan(rendered.indexOf('NoDate'))
  })

  it('links each deployment to its detail route', () => {
    mockDeployments = [deployment({ deploymentId: 'dep-42' })]

    const links = mountView().findAllComponents(RouterLinkStub)
    const detail = links.find(
      (l) => (l.props('to') as any)?.name === 'deployments.detail',
    )

    expect(detail).toBeDefined()
    expect((detail!.props('to') as any).params).toEqual({ id: 'dep-42' })
  })

  it('offers a route to the app catalogue when there is nothing to show', () => {
    mockDeployments = []
    mockDeploymentsLoading = false

    const wrapper = mountView()

    expect(wrapper.text()).toContain('DeploymentsView.deploymentsMissingMessage')
    const targets = wrapper
      .findAllComponents(RouterLinkStub)
      .map((l) => (l.props('to') as any)?.name)
    expect(targets).toContain('apps')
  })

  it('shows neither the empty message nor any deployment while loading', () => {
    // EntityListState gives isLoading precedence over isEmpty, so the
    // empty-state CTA must not flash before the first response lands.
    mockDeploymentsLoading = true
    mockDeployments = []

    expect(mountView().text()).not.toContain('DeploymentsView.deploymentsMissingMessage')
  })
})
