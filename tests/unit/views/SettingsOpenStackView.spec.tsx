import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route, useLocation } from 'react-router'

// Assertions are on the payload handed to the API and the i18n *key* passed to
// the toast, never on rendered German; data-testid is the testing contract.

vi.mock('@/api/credentials.api', () => ({
  credentialsApi: { get: vi.fn(), put: vi.fn(), test: vi.fn(), remove: vi.fn(), putFromYaml: vi.fn() },
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
const status = (over: Record<string, unknown> = {}) => ({ data: { has_credential: false, ...over } }) as any

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
  vi.mocked(credentialsApi.get).mockResolvedValue(status())
})
afterEach(() => {
  window.confirm = originalConfirm
})

describe('SettingsOpenStackView', () => {
  it('loads the stored credential on mount', async () => {
    renderView()
    await waitFor(() => expect(credentialsApi.get).toHaveBeenCalledTimes(1))
  })

  it('prefills the form from an existing application credential', async () => {
    vi.mocked(credentialsApi.get).mockResolvedValue(
      status({
        has_credential: true,
        auth_type: 'v3applicationcredential',
        auth_url: 'https://my-cloud.com:5000/v3',
        region_name: 'RegionOne',
      }),
    )
    renderView()

    await waitFor(() => expect(field('app-auth-url').value).toBe('https://my-cloud.com:5000/v3'))
    expect(field('app-region').value).toBe('RegionOne')
  })

  it('prefills the password tab for a password credential', async () => {
    vi.mocked(credentialsApi.get).mockResolvedValue(
      status({ has_credential: true, auth_type: 'password', auth_url: 'https://pwd', project_name: 'proj' }),
    )
    renderView()

    await waitFor(() => expect(field('pwd-auth-url').value).toBe('https://pwd'))
    expect(field('pwd-project-name').value).toBe('proj')
    expect(field('pwd-user-domain').value).toBe('Default')
  })

  // --- locked state ---

  it('disables the form and the destructive actions while deployments are active', async () => {
    vi.mocked(credentialsApi.get).mockResolvedValue(
      status({
        has_credential: true,
        auth_type: 'v3applicationcredential',
        is_locked: true,
        active_deployments: 2,
      }),
    )
    renderView()

    await screen.findByTestId('btn-delete')
    expect(field('app-auth-url')).toBeDisabled()
    expect(screen.getByTestId('btn-save')).toBeDisabled()
    expect(screen.getByTestId('btn-delete')).toBeDisabled()
    expect(screen.getByText('SettingsOpenStackView.lockBanner.title')).toBeInTheDocument()
  })

  // --- saving ---

  it('refuses to save with required fields missing and says why', async () => {
    renderView()
    await waitFor(() => expect(credentialsApi.get).toHaveBeenCalled())

    await userEvent.click(screen.getByTestId('btn-save'))

    expect(credentialsApi.put).not.toHaveBeenCalled()
    expect(toasts()).toContainEqual(['error', 'SettingsOpenStackView.errors.missingFields'])
  })

  it('saves an application credential with the fields the API expects', async () => {
    vi.mocked(credentialsApi.put).mockResolvedValue(status({ has_credential: true }))
    renderView()
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() =>
      expect(credentialsApi.put).toHaveBeenCalledWith({
        auth_type: 'v3applicationcredential',
        auth_url: 'https://test.com',
        region_name: null,
        interface: 'public',
        identity_api_version: '3',
        identifier: 'my-app-id',
        secret: 'my-secret-key',
      }),
    )
    expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.toasts.saveSuccess'])
  })

  it('clears the secret from the form after a successful save', async () => {
    vi.mocked(credentialsApi.put).mockResolvedValue(status({ has_credential: true }))
    renderView()
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => expect(field('app-secret').value).toBe(''))
  })

  it('returns to the wizard after saving when ?next= is present', async () => {
    vi.mocked(credentialsApi.put).mockResolvedValue(status({ has_credential: true }))
    renderView('/user/openstack?next=/deployment/new/summary')
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/deployment/new/summary'))
  })

  it('warns instead of celebrating when the credential saves but fails validation', async () => {
    vi.mocked(credentialsApi.put).mockResolvedValue(
      status({ has_credential: true, last_validation_error: 'invalid credentials' }),
    )
    renderView()
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => expect(toasts().some(([type]) => type === 'warning')).toBe(true))
    expect(toasts().some(([type]) => type === 'success')).toBe(false)
  })

  it('shows the store error when saving fails', async () => {
    vi.mocked(credentialsApi.put).mockRejectedValue({
      isAxiosError: true,
      response: { data: { detail: 'bad payload' } },
    })
    renderView()
    await fillAppForm()

    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() => expect(toasts().some(([type]) => type === 'error')).toBe(true))
  })

  it('saves a password credential from the second tab', async () => {
    vi.mocked(credentialsApi.put).mockResolvedValue(status({ has_credential: true }))
    renderView()

    await userEvent.click(screen.getByTestId('tab-password'))
    await userEvent.type(field('pwd-auth-url'), 'https://pwd-cloud.com')
    await userEvent.type(field('pwd-identifier'), 'admin')
    await userEvent.type(field('pwd-project-id'), 'project-123')
    await userEvent.type(field('pwd-secret'), 'super-secret')
    await userEvent.click(screen.getByTestId('btn-save'))

    await waitFor(() =>
      expect(credentialsApi.put).toHaveBeenCalledWith({
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

    expect(credentialsApi.put).not.toHaveBeenCalled()
    expect(toasts()).toContainEqual(['error', 'SettingsOpenStackView.errors.missingFields'])
  })

  // --- retest / delete ---

  it('re-validates the stored credential', async () => {
    vi.mocked(credentialsApi.get).mockResolvedValue(status({ has_credential: true }))
    vi.mocked(credentialsApi.test).mockResolvedValue(
      status({ has_credential: true, last_validated_at: '2026-01-01T00:00:00Z' }),
    )
    renderView()

    await userEvent.click(await screen.findByTestId('btn-retest'))

    await waitFor(() => expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.toasts.credentialsValid']))
  })

  it('does not delete when the confirmation dialog is dismissed', async () => {
    vi.mocked(credentialsApi.get).mockResolvedValue(status({ has_credential: true }))
    confirm.mockReturnValue(false)
    renderView()

    await userEvent.click(await screen.findByTestId('btn-delete'))

    expect(confirm).toHaveBeenCalled()
    expect(credentialsApi.remove).not.toHaveBeenCalled()
  })

  it('deletes once the confirmation is accepted', async () => {
    vi.mocked(credentialsApi.get).mockResolvedValue(status({ has_credential: true }))
    vi.mocked(credentialsApi.remove).mockResolvedValue({} as any)
    confirm.mockReturnValue(true)
    renderView()

    await userEvent.click(await screen.findByTestId('btn-delete'))

    await waitFor(() => expect(credentialsApi.remove).toHaveBeenCalledTimes(1))
    expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.status.deleteSuccess'])
  })

  // --- clouds.yaml upload ---

  const uploadYaml = async (content: string) => {
    const file = new File([content], 'clouds.yaml', { type: 'text/yaml' })
    Object.defineProperty(file, 'text', { value: vi.fn().mockResolvedValue(content) })
    fireEvent.change(screen.getByTestId('yaml-input'), { target: { files: [file] } })
  }

  it('fills the form from an uploaded clouds.yaml', async () => {
    vi.mocked(parseCloudsYaml).mockReturnValue({
      auth_type: 'v3applicationcredential',
      auth_url: 'https://yaml.com',
      region_name: 'RegionYaml',
      identifier: 'yaml-id',
      secret: 'yaml-secret',
    } as any)
    renderView()

    await uploadYaml('dummy yaml content')

    await waitFor(() => expect(field('app-auth-url').value).toBe('https://yaml.com'))
    expect(parseCloudsYaml).toHaveBeenCalledWith('dummy yaml content')
    expect(toasts()).toContainEqual(['success', 'SettingsOpenStackView.cloudsYamlImported'])
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
