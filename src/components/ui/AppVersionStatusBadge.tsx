import { Globe, Clock, XCircle, MinusCircle, Lock, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppVersionBadgeStatus } from '@/types'
import Badge, { type BadgeVariant } from './Badge'

export default function AppVersionStatusBadge({ status }: { status: AppVersionBadgeStatus }) {
  const { t } = useTranslation()

  let Icon: LucideIcon = MinusCircle
  let label = '-'
  let variant: BadgeVariant = 'neutral'

  switch (status) {
    case 'new':
      label = t('AppVersionStatusBadge.new')
      break
    case 'pending':
      Icon = Clock
      label = t('AppVersionStatusBadge.pending')
      variant = 'warning'
      break
    case 'approved':
    case 'published':
      Icon = Globe
      label = t('AppVersionStatusBadge.published')
      variant = 'success'
      break
    case 'rejected':
      Icon = XCircle
      label = t('AppVersionStatusBadge.rejected')
      variant = 'danger'
      break
    case 'private':
      Icon = Lock
      label = t('AppVersionStatusBadge.private')
      variant = 'brand'
      break
  }

  return (
    <Badge variant={variant} bordered>
      <Icon size={11} className="mr-1" />
      {label}
    </Badge>
  )
}
