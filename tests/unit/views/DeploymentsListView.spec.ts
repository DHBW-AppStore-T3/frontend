import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DeploymentsListView from '@/views/DeploymentsListView.vue' // Falls '@' zickt: '../../../src/views/DeploymentsView.vue'

// ---------------------------------------------------------
// 1. Mocks & Setup
// ---------------------------------------------------------

vi.mock('lucide-vue-next', () => ({
  BarChart3: { template: '<span class="icon-barchart" />' },
  Plus: { template: '<span />' },
  Inbox: { template: '<span class="icon-inbox" />' },
  GitBranch: { template: '<span />' },
  Box: { template: '<span />' },
  Clock: { template: '<span />' },
  Loader2: { template: '<span class="icon-loader" />' }
}))

let mockDeployments: any[] = []
let mockDeploymentsLoading = false
let mockApps: any[] = []

const mockFetchDeployments = vi.fn()
const mockFetchApps = vi.fn()

vi.mock('@/stores/deployment.store', () => ({
  useDeploymentStore: () => ({
    get deployments() { return mockDeployments },
    get isLoading() { return mockDeploymentsLoading },
    fetchDeployments: mockFetchDeployments
  })
}))

vi.mock('@/stores/app.store', () => ({
  useAppStore: () => ({
    get apps() { return mockApps },
    fetchApps: mockFetchApps
  })
}))

// ---------------------------------------------------------
// 2. Die Tests
// ---------------------------------------------------------

// TODO: Tests gegen die neue View-Struktur neu schreiben (main hat
// die Liste auf PageHeader + EntityListState + Card umgebaut). Bis
// dahin geskippt.
describe('DeploymentsListView.vue', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    mockDeployments = []
    mockDeploymentsLoading = false
    mockApps = []
  })

  const mountComponent = () => {
    return mount(DeploymentsListView, {
      global: {
        mocks: {
          $t: (key: string, vars?: any) => vars ? `${key} ${JSON.stringify(vars)}` : key
        },
        stubs: {
          RouterLink: { template: '<a><slot /></a>' },
          BaseButton: { template: '<button><slot /></button>' },
        }
      }
    })
  }

  // --- 1. Lifecycle & API Calls ---
  it('lädt alle notwendigen Daten beim Starten der View', async () => {
    mountComponent()
    await flushPromises()
    expect(mockFetchDeployments).toHaveBeenCalledTimes(1)
    expect(mockFetchApps).toHaveBeenCalledTimes(1)
  })

  // --- 2. Logik-Tests über das Template (Ersetzt die vm-Aufrufe) ---

  it('getAppName: mappt die appId korrekt auf den App-Namen im Template', () => {
    mockDeployments = [{ deploymentId: '1', appId: 'app-123', status: 'success', name: 'Dep 1', releaseTag: 'v1', created_at: '2026-06-08T15:30:00Z' }]
    mockApps = [{ appId: 'app-123', name: 'Mein Backend' }]

    const wrapper = mountComponent()
    
    expect(wrapper.text()).toContain('Mein Backend')
  })

  it('getAppName: zeigt "-", wenn die App nicht gefunden wird', () => {
    mockDeployments = [{ deploymentId: '1', appId: 'unbekannt', status: 'success', name: 'Dep 1', releaseTag: 'v1', created_at: '2026-06-08T15:30:00Z' }]
    mockApps = [] // Keine Apps geladen

    const wrapper = mountComponent()
    
    expect(wrapper.text()).toContain('-')
  })

  it('formatDate: formatiert das Datum korrekt im Template', () => {
    mockDeployments = [{ deploymentId: '1', appId: '1', status: 'success', name: 'Dep 1', releaseTag: 'v1', created_at: '2026-06-08T15:30:00Z' }]
    
    const wrapper = mountComponent()
    
    // Wir prüfen, ob das formatierte Datum im HTML landet
    expect(wrapper.text()).toContain('08.06.2026')
  })

  it('getStatusColor: setzt die korrekten CSS-Klassen basierend auf dem Status', () => {
    mockDeployments = [{ deploymentId: '1', appId: '1', status: 'failed', name: 'Dep 1', releaseTag: 'v1', created_at: '2026-06-08T15:30:00Z' }]
    
    const wrapper = mountComponent()
    const statusSpan = wrapper.find('.capitalize') // Das Element mit :class="getStatusColor(...)"
    
    // Überprüft das Ergebnis von getStatusColor('failed') direkt am Element
    expect(statusSpan.classes()).toContain('bg-red-100')
    expect(statusSpan.classes()).toContain('text-red-800')
  })

  // --- 3. UI-Zustände ---

  it('zeigt den Loader, wenn isLoading true ist', () => {
    mockDeploymentsLoading = true
    const wrapper = mountComponent()

    expect(wrapper.find('.icon-loader').exists()).toBe(true)
  })

  it('zeigt die "Keine Deployments"-Meldung, wenn die Liste leer ist', () => {
    mockDeploymentsLoading = false
    mockDeployments = []
    const wrapper = mountComponent()

    expect(wrapper.text()).toContain('DeploymentsView.deploymentsMissingMessage')
  })
})