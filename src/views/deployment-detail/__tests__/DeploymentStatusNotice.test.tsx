import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../tests/helpers/render'
import DeploymentStatusNotice from '../DeploymentStatusNotice'
import de from '@/i18n/locales/de'
import en from '@/i18n/locales/en'

const show = (props: Parameters<typeof DeploymentStatusNotice>[0]) =>
  renderWithProviders(<DeploymentStatusNotice {...props} />)

describe('DeploymentStatusNotice', () => {
  it('tells a student that a failed deployment cannot be used (alert)', () => {
    show({ status: 'failed', pollingState: 'idle', isMemberView: true })
    expect(screen.getByRole('alert')).toHaveTextContent('DeploymentDetailView.statusFailedHint')
  })

  it('shows nothing for the owner view of a failed deployment', () => {
    const { container } = show({ status: 'failed', pollingState: 'idle', isMemberView: false })
    expect(container).toBeEmptyDOMElement()
  })

  it('reports a degraded connection as a status message', () => {
    show({ status: 'running', pollingState: 'degraded', isMemberView: true })
    expect(screen.getByRole('status')).toHaveTextContent('DeploymentDetailView.statusPollingDegraded')
  })

  it('reports lost access, which wins over failed', () => {
    show({ status: 'failed', pollingState: 'forbidden', isMemberView: true })
    expect(screen.getByRole('status')).toHaveTextContent('DeploymentDetailView.statusPollingForbidden')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it.each(['success', 'running'])('shows nothing for %s', (status) => {
    const { container } = show({ status, pollingState: 'polling', isMemberView: true })
    expect(container).toBeEmptyDOMElement()
  })
})

describe('locale parity', () => {
  it('de and en have the same DeploymentDetailView.status* keys', () => {
    const keys = (l: any) =>
      Object.keys(l.DeploymentDetailView ?? {}).filter((k) => k.startsWith('status')).sort()
    expect(keys(de)).toEqual(['statusFailedHint', 'statusGoneToast', 'statusPollingDegraded', 'statusPollingForbidden'])
    expect(keys(en)).toEqual(keys(de))
  })
})
