import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18next from 'i18next'
import StoreTab, { type StoreTabProps } from '../StoreTab'
import type { AppVersionApproval } from '@/types'
import type { AppDetail } from '../versionInfo'

const i18n = i18next.createInstance()
void i18n.init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        'AppsDetailView.submitButton': 'Submit for review',
        'AppsDetailView.resubmitButton': 'Resubmit',
        'AppsDetailView.withdrawButton': 'Withdraw',
      },
    },
  },
  showSupportNotice: false,
  initImmediate: false,
})

const app = { appId: 'a1', name: 'demo', is_private: false, hidden_by_admin: false } as unknown as AppDetail

const approval = (status: string) => ({ status, rejection_reason: 'no' }) as unknown as AppVersionApproval

const renderTab = (props: Partial<StoreTabProps>) => {
  const onSubmitVersion = vi.fn()
  const onWithdrawVersion = vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <StoreTab
        app={app}
        banner="none"
        versionOptions={['v2.0.1']}
        approvalByVersion={{}}
        canSubmitVersion={false}
        isAdmin={false}
        isTogglingPrivacy={false}
        withdrawingVersion={null}
        onTogglePrivacy={() => {}}
        onSubmitVersion={onSubmitVersion}
        onWithdrawVersion={onWithdrawVersion}
        {...props}
      />
    </I18nextProvider>,
  )
  return { onSubmitVersion, onWithdrawVersion }
}

afterEach(cleanup)

describe('StoreTab version actions', () => {
  it('offers to submit a version to whoever may submit (owner or admin)', () => {
    const { onSubmitVersion } = renderTab({ canSubmitVersion: true })

    fireEvent.click(screen.getByText('Submit for review'))

    expect(onSubmitVersion).toHaveBeenCalledWith('v2.0.1')
  })

  it('offers withdraw for a pending and resubmit for a rejected version', () => {
    const { onWithdrawVersion } = renderTab({ canSubmitVersion: true, approvalByVersion: { 'v2.0.1': approval('pending') } })
    fireEvent.click(screen.getByText('Withdraw'))
    expect(onWithdrawVersion).toHaveBeenCalledWith('v2.0.1')
    cleanup()

    renderTab({ canSubmitVersion: true, approvalByVersion: { 'v2.0.1': approval('rejected') } })
    expect(screen.getByText('Resubmit')).toBeTruthy()
  })

  it('shows no action to anybody else', () => {
    renderTab({ canSubmitVersion: false })
    expect(screen.queryByText('Submit for review')).toBeNull()
    cleanup()

    renderTab({ canSubmitVersion: false, approvalByVersion: { 'v2.0.1': approval('pending') } })
    expect(screen.queryByText('Withdraw')).toBeNull()
    cleanup()

    renderTab({ canSubmitVersion: false, approvalByVersion: { 'v2.0.1': approval('rejected') } })
    expect(screen.queryByText('Resubmit')).toBeNull()
  })
})
