import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

// Assertions are on the payload handed to the API and the i18n *key* passed to
// the toast, never on rendered German; data-testid is the testing contract.
//
// One credential per OpenStack project: the page lists them, adds new ones
// (Keystone names the project) and checks or deletes each one.

vi.mock('@/api/credentials.api', () => ({
  credentialsApi: { list: vi.fn(), save: vi.fn(), test: vi.fn(), remove: vi.fn(), saveFromYaml: vi.fn() },
}))
vi.mock('@/utils/clouds-yaml', () => ({
  parseCloudsYaml: vi.fn(),
  CloudsYamlError: class extends Error {},
}))

import { credentialsApi } from '@/api/credentials.api'
import { parseCloudsYaml } from '@/utils/clouds-yaml'
import SettingsOpenStackView from '@/views/SettingsOpenStackView'
import { useOpenStackCredentialsStore } from '@/stores/openstack-credentials.store'
import { useToastStore } from '@/stores/toast.store'
import type { OpenStackCredential } from '@/types/openstack-credential'
import { renderWithProviders } from '../../helpers/render'

function Where() {
  const l = useLocation()
  return <div data-testid="where">{l.pathname}</div>
}

const renderView = (route = '/user/openstack') =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/user/openstack" element={<SettingsOpenStackView />} />
        <Route path="*" element={<p>elsewhere</p>} />
      </Routes>
      <Where />
    </>,
    { route },
  )

const toasts = () => useToastStore.getState().toasts.map((t) => [t.type, t.message])
const field = (id: string) => screen.getByTestId(id) as HTMLInputElement

function credential(overrides: Partial<OpenStackCredential> = {}): OpenStackCredential {
  return {
    credentialId: 'c-1',
    auth_type: 'v3applicationcredential',
    auth_url: 'https://keystone.example/v3',
    project_id: 'p-1',
    project_name: 'Project One',
    project_verified: true,
    last_validated_at: '2026-10-15T08:00:00Z',
    last_validation_error: null,
    active_deployments: 0,
    ...overrides,
  } as OpenStackCredential
}

const listReturns = (rows: OpenStackCredential[]) =>
  vi.mocked(credentialsApi.list).mockResolvedValue({ data: rows } as never)

const fillAppForm = async () => {
  await userEvent.type(field('app-auth-url'), 'https://test.com')
  await userEvent.type(field('app-identifier'), 'my-app-id')
  await userEvent.type(field('app-secret'), 'my-secret-key')
}

const originalConfirm = window.confirm
const confirm = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  window.confirm = confirm
  useToastStore.setState({ toasts: [] })
  useOpenStackCredentialsStore.getState().reset()
  listReturns([])
  vi.mocked(credentialsApi.save).mockResolvedValue({ data: credential() } as never)
})
afterEach(() => {
  window.confirm = originalConfirm
})

describe('SettingsOpenStackView', () => {
  it('loads the credentials on mount', async () => {
    renderView()
    await waitFor(() => expect(credentialsApi.list).toHaveBeenCalledTimes(1))
  })

  it('without credentials explains that only VM apps need one', async () => {
    renderView()

    expect(await screen.findByText('SettingsOpenStackView.status.noneTitle')).toBeInTheDocument()
    expect(screen.getByText('SettingsOpenStackView.vmOnlyHint')).toBeInTheDocument()
  })

  // --- the list ---

  it('lists one row per project with its state', async () => {
    listReturns([
      credential(),
      credential({ credentialId: 'c-2', project_id: 'typed', project_name: null, project_verified: false }),
      credential({ credentialId: 'c-3', project_id: 'p-3', project_name: 'Project Three', last_validation_error: 'invalid_credentials' }),
    ])
    renderView()

    const first = await screen.findByTestId('credential-c-1')
    expect(first).toHaveTextContent('Project One')
    expect(first).toHaveTextContent('SettingsOpenStackView.status.lastChecked')
    // Saved before projects were checked: must be checked once before use.
    expect(screen.getByTestId('credential-c-2')).toContainElement(screen.getByTestId('credential-unverified'))
    expect(screen.getByTestId('credential-c-3')).toHaveTextContent('invalid_credentials')
  })

  it('a credential with active deployments cannot be deleted, the others can', async () => {
    listReturns([
      credential({ active_deployments: 2 }),
      credential({ credentialId: 'c-2', project_id: 'p-2', project_name: 'Project Two' }),
    ])
    renderView()

    const locked = await screen.findByTestId('btn-delete-c-1')
    expect(locked).toBeDisabled()
    expect(locked).toHaveAttribute('title', 'SettingsOpenStackView.tooltips.lockedActiveDeployments')
    expect(screen.getByTestId('credential-c-1')).toHaveTextContent('SettingsOpenStackView.status.activeDeployments')
    expect(screen.getByTestId('btn-delete-c-2')).toBeEnabled()
    // Adding a credential for another project stays possible.
    expect(screen.getByTestId('btn-save')).toBeEnabled()
  })

  // --- saving ---

  it('refuses to save with required fields missing and says why', async () => {
    renderView()
    await waitFor(() => expect(credentialsApi.list).toHaveBeenCalled())

    await userEvent.click(screen.getByTestId('btn-save'))

    expect(credentialsApi.save).not.toHaveBeenCalled()
    expect(toasts()).toContainEqual(['error', 'SettingsOpenStackView.errors.missingFields'])
  })

  it('saves an application credential and re-reads the list', async () => {
    renderView()
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() =>
      expect(credentialsApi.save).toHaveBeenCalledWith({
        auth_type: 'v3applicationcredential',
        auth_url: 'https://test.com',
        region_name: null,
        interface: 'public',
        identity_api_version: '3',
        identifier: 'my-app-id',
        secret: 'my-secret-key',
      }),
    )
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.toasts.saveSuccess']))
    expect(credentialsApi.list).toHaveBeenCalledTimes(2)
  })

  it('clears the identifier and secret from the form after a successful save', async () => {
    renderView()
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => expect(field('app-secret').value).toBe(''))
    expect(field('app-identifier').value).toBe('')
  })

  it('shows why Keystone rejected a credential and stores nothing', async () => {
    vi.mocked(credentialsApi.save).mockRejectedValue({
      isAxiosError: true,
      response: { status: 422, data: { detail: { reason: 'openstack_credentials_invalid', cause: 'auth_url_not_allowed' } } },
    })
    renderView('/user/openstack?next=/deployment/new/config')
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => expect(toasts().some(([type, msg]) => type === 'error' && String(msg).includes('auth_url_not_allowed'))).toBe(true))
    expect(toasts().some(([type]) => type === 'success')).toBe(false)
    expect(screen.getByTestId('where')).toHaveTextContent('/user/openstack')
  })

  it('saves a password credential from the second tab', async () => {
    renderView()

    await userEvent.click(screen.getByTestId('tab-password'))
    await userEvent.type(field('pwd-auth-url'), 'https://pwd-cloud.com')
    await userEvent.type(field('pwd-identifier'), 'admin')
    await userEvent.type(field('pwd-project-id'), 'project-123')
    await userEvent.type(field('pwd-secret'), 'super-secret')
    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() =>
      expect(credentialsApi.save).toHaveBeenCalledWith({
        auth_type: 'password',
        auth_url: 'https://pwd-cloud.com',
        region_name: null,
        interface: 'public',
        identity_api_version: '3',
        identifier: 'admin',
        secret: 'super-secret',
        project_id: 'project-123',
        project_name: null,
        user_domain_name: 'Default',
        project_domain_name: null,
      }),
    )
  })

  it('requires a project id or name before saving a password credential', async () => {
    renderView()

    await userEvent.click(screen.getByTestId('tab-password'))
    await userEvent.type(field('pwd-auth-url'), 'https://pwd-cloud.com')
    await userEvent.type(field('pwd-identifier'), 'admin')
    await userEvent.type(field('pwd-secret'), 'super-secret')
    await userEvent.click(screen.getByTestId('btn-save'))

    expect(credentialsApi.save).not.toHaveBeenCalled()
    expect(toasts()).toContainEqual(['error', 'SettingsOpenStackView.errors.missingFields'])
  })

  // --- back to the wizard ---

  it('returns to the wizard step that sent the user here', async () => {
    renderView('/user/openstack?next=/deployment/new/config')
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/config'))
  })

  it.each([
    ['https://evil.example/phish'],
    ['//evil.example/phish'],
    ['/\\evil.example/phish'],
    ['javascript:alert(1)'],
  ])('never follows a return target outside the app (%s)', async (next) => {
    renderView(`/user/openstack?next=${encodeURIComponent(next)}`)
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => expect(credentialsApi.save).toHaveBeenCalled())
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.toasts.saveSuccess']))
    expect(screen.getByTestId('where')).toHaveTextContent('/user/openstack')
  })

  // --- check ---

  it('re-checks a credential and reports a pass', async () => {
    listReturns([credential()])
    vi.mocked(credentialsApi.test).mockResolvedValue({ data: credential() } as never)
    renderView()

    await userEvent.click(await screen.findByTestId('btn-retest-c-1'))

    expect(credentialsApi.test).toHaveBeenCalledWith('c-1')
    await waitFor(() => expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.toasts.credentialsValid']))
  })

  it('re-checks a credential and reports what Keystone said', async () => {
    listReturns([credential()])
    vi.mocked(credentialsApi.test).mockResolvedValue({
      data: credential({ last_validation_error: 'invalid_credentials' }),
    } as never)
    renderView()

    await userEvent.click(await screen.findByTestId('btn-retest-c-1'))

    await waitFor(() => expect(toasts()).toContainEqual(['error', 'SettingsOpenStackView.errors.validationFailed']))
  })

  // --- delete ---

  it('does not delete when the confirmation dialog is dismissed', async () => {
    listReturns([credential()])
    confirm.mockReturnValue(false)
    renderView()

    await userEvent.click(await screen.findByTestId('btn-delete-c-1'))

    expect(confirm).toHaveBeenCalledWith('SettingsOpenStackView.confirmDelete')
    expect(credentialsApi.remove).not.toHaveBeenCalled()
  })

  it('deletes once the confirmation is accepted, and the row disappears', async () => {
    listReturns([credential()])
    vi.mocked(credentialsApi.remove).mockResolvedValue({} as never)
    confirm.mockReturnValue(true)
    renderView()

    await userEvent.click(await screen.findByTestId('btn-delete-c-1'))

    await waitFor(() => expect(credentialsApi.remove).toHaveBeenCalledWith('c-1'))
    expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.status.deleteSuccess'])
    await waitFor(() => expect(screen.queryByTestId('credential-c-1')).not.toBeInTheDocument())
  })

  // --- clouds.yaml upload ---

  const uploadYaml = async (content: string) => {
    const file = new File([content], 'clouds.yaml', { type: 'text/yaml' })
    Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue(content) })
    fireEvent.change(screen.getByTestId('yaml-input'), { target: { files: [file] } })
  }

  it('fills the form from an uploaded clouds.yaml and stores nothing yet', async () => {
    vi.mocked(parseCloudsYaml).mockReturnValue({
      auth_type: 'v3applicationcredential',
      auth_url: 'https://yaml.com',
      region_name: 'RegionYaml',
      identifier: 'yaml-id',
      secret: 'yaml-secret',
    } as never)
    renderView()

    await uploadYaml('dummy yaml content')

    await waitFor(() => expect(field('app-auth-url').value).toBe('https://yaml.com'))
    expect(parseCloudsYaml).toHaveBeenCalledWith('dummy yaml content')
    expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.cloudsYamlImported'])
    expect(credentialsApi.save).not.toHaveBeenCalled()
  })

  it('rejects an empty file', async () => {
    renderView()
    await uploadYaml('   ')
    await waitFor(() => expect(toasts()).toContainEqual(['error', 'SettingsOpenStackView.fileEmpty']))
    expect(parseCloudsYaml).not.toHaveBeenCalled()
  })

  it('reports an unparsable file', async () => {
    vi.mocked(parseCloudsYaml).mockImplementation(() => {
      throw new Error('boom')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderView()

    await uploadYaml('x: [')

    await waitFor(() => expect(toasts()).toContainEqual(['error', 'SettingsOpenStackView.cloudsYamlError']))
  })
})
