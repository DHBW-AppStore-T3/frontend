import { describe, it, expect, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../tests/helpers/render'
import TeamsCard, { type TeamsCardProps } from '../TeamsCard'
import { enrichTeams, type AccountHit, type UserAccount } from '../helpers'

const MEMBER = { userId: 'u-lea', username: 'lea', email: 'lea@x.de' }
const teams = [{ teamId: 't1', name: 'Team A', members: [MEMBER] }] as any

const podAccount: UserAccount = {
  username: 'lea',
  auth: 'pw-lea',
  url: 'https://ide-lea.example',
  type: 'password',
  user_id: 'u-lea',
}
const own = (data: UserAccount): AccountHit => ({ key: 'Team A-u-lea', data })

function show(overrides: Partial<TeamsCardProps> & { account?: AccountHit | null; vmUrl?: string | null } = {}) {
  const { account = null, vmUrl = null, ...props } = overrides
  const enriched = enrichTeams(teams, vmUrl ? { 'Team A': { url: vmUrl } } : {}, account ? 'u-lea' : undefined, account)
  const onReveal = vi.fn(async () => null as AccountHit | null)
  const view = renderWithProviders(
    <TeamsCard
      teamCount={1}
      teams={enriched}
      copiedKey={null}
      onCopy={() => {}}
      canReveal={false}
      onReveal={onReveal}
      {...props}
    />,
  )
  return { ...view, onReveal: (props.onReveal ?? onReveal) as ReturnType<typeof vi.fn> }
}

/** The text of the pills of the one member row, in DOM order. */
const pillLabels = () =>
  Array.from(document.querySelectorAll('span.uppercase')).map((el) => el.textContent?.trim())

describe('TeamsCard — order: link, login, password', () => {
  it('shows the link first, then the login, then the password (web app with a team url)', () => {
    show({ account: own({ ...podAccount, url: undefined }), vmUrl: 'https://team.example' })

    expect(pillLabels()).toEqual(['URL:', 'User:', 'PW:'])
  })

  it('links a member to their own url: a scope: user account has no team url', () => {
    show({ account: own(podAccount), vmUrl: null })

    const link = screen.getByRole('link', { name: 'ide-lea.example' })
    expect(link).toHaveAttribute('href', 'https://ide-lea.example/')
    expect(pillLabels()).toEqual(['URL:', 'User:', 'PW:'])
  })

  it('keeps the password masked until the eye is clicked', async () => {
    show({ account: own(podAccount) })

    expect(screen.queryByText('pw-lea')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Passwort anzeigen' }))
    expect(screen.getByText('pw-lea')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Passwort verbergen' }))
    expect(screen.queryByText('pw-lea')).not.toBeInTheDocument()
  })

  it('keeps the SSH command for an ssh account (login is inside it, so no extra User pill)', () => {
    show({ account: own({ username: 'lea', ip: '10.0.0.5', port: 22, auth: 'pw', type: 'password' }) })

    expect(screen.getByText('ssh lea@10.0.0.5')).toBeInTheDocument()
    expect(pillLabels()).toEqual(['SSH:', 'PW:'])
  })

  it('shows the RDP command, then the login, then the password for a Windows account (mstsc carries no login)', () => {
    show({ account: own({ username: 'lea', ip: 'fd00::1', port: 3389, authtype: 'rdp', auth: 'pw', type: 'password' }) })

    expect(screen.getByText('mstsc /v:[fd00::1]:3389')).toBeInTheDocument()
    // Once in the member header, once in the User pill.
    expect(screen.getAllByText('lea')).toHaveLength(2)
    expect(pillLabels()).toEqual(['RDP:', 'User:', 'PW:'])
  })

  it('never links a javascript: url', () => {
    show({ account: own({ ...podAccount, url: 'javascript:alert(1)' }) })

    expect(screen.getByText('javascript:alert(1)').closest('a')).not.toHaveAttribute('href')
  })
})

describe('TeamsCard — the deploying teacher (no account of their own)', () => {
  it('shows the team link on the member row even without credentials', () => {
    show({ vmUrl: 'https://team.example' })

    expect(screen.getByRole('link', { name: 'team.example' })).toHaveAttribute('href', 'https://team.example/')
    expect(screen.queryByText('PW:')).not.toBeInTheDocument()
  })

  it('shows the member\'s own workload link (scope: user) from the workload list', () => {
    const workloads = [{ workload: 'ide-lea', user_id: 'u-lea', url: 'https://ide-lea.example' }] as any
    const enriched = enrichTeams(teams, {}, undefined, null, workloads)
    renderWithProviders(
      <TeamsCard teamCount={1} teams={enriched} copiedKey={null} onCopy={() => {}} canReveal={false} onReveal={vi.fn()} />,
    )

    expect(screen.getByRole('link', { name: 'ide-lea.example' })).toHaveAttribute('href', 'https://ide-lea.example/')
  })

  it('offers no reveal without the operate right', () => {
    show({ canReveal: false })

    expect(screen.queryByRole('button', { name: 'DeploymentDetailView.revealCredentials' })).not.toBeInTheDocument()
  })

  it('reveals one member\'s login and password on click, after the link', async () => {
    const onReveal = vi.fn(async () => own(podAccount))
    show({ canReveal: true, onReveal, vmUrl: 'https://team.example' })
    expect(screen.queryByText('PW:')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'DeploymentDetailView.revealCredentials' }))

    await waitFor(() => expect(pillLabels()).toEqual(['URL:', 'User:', 'PW:']))
    expect(onReveal).toHaveBeenCalledWith('u-lea')
    expect(screen.queryByRole('button', { name: 'DeploymentDetailView.revealCredentials' })).not.toBeInTheDocument()
    // Still masked: revealing fetches, showing the password is a second click.
    expect(screen.queryByText('pw-lea')).not.toBeInTheDocument()
  })

  it('does not fetch anything before the click', () => {
    const onReveal = vi.fn()
    show({ canReveal: true, onReveal })

    expect(onReveal).not.toHaveBeenCalled()
  })

  it('says so when the member has no credentials', async () => {
    const onReveal = vi.fn(async () => null)
    show({ canReveal: true, onReveal })

    await userEvent.click(screen.getByRole('button', { name: 'DeploymentDetailView.revealCredentials' }))

    expect(await screen.findByText('DeploymentDetailView.noCredentials')).toBeInTheDocument()
  })

  it('reports a failed fetch and lets the teacher retry', async () => {
    const onReveal = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(own(podAccount))
    show({ canReveal: true, onReveal })

    await userEvent.click(screen.getByRole('button', { name: 'DeploymentDetailView.revealCredentials' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('DeploymentDetailView.revealFailed')

    await userEvent.click(screen.getByRole('button', { name: 'DeploymentDetailView.revealCredentials' }))
    await waitFor(() => expect(pillLabels()).toContain('PW:'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('does not offer the reveal on a row that already has the caller\'s own account', () => {
    show({ canReveal: true, account: own(podAccount) })

    expect(screen.queryByRole('button', { name: 'DeploymentDetailView.revealCredentials' })).not.toBeInTheDocument()
    expect(within(document.body).getByText('PW:')).toBeInTheDocument()
  })
})
