import { Link } from 'react-router'
import { AlertTriangle, AlertCircle, Lock, type LucideIcon } from 'lucide-react'

type Variant = 'warning' | 'error' | 'lock'

export interface CredentialMissingBannerProps {
  variant?: Variant
  title?: string
  message?: string
  cta?: string
  ctaTo?: string
  /** Where the settings page should send the user back to afterwards (``?next=``). */
  next?: string
}

interface Styles {
  wrapper: string
  iconBox: string
  title: string
  message: string
  cta: string
  Icon: LucideIcon
}

const STYLES: Record<Variant, Styles> = {
  error: {
    wrapper: 'bg-dangerTint border-danger/30 text-red-900',
    iconBox: 'bg-dangerTint text-danger',
    title: 'text-red-900',
    message: 'text-red-800',
    cta: 'bg-red-600 hover:bg-red-700 text-white',
    Icon: AlertCircle,
  },
  lock: {
    wrapper: 'bg-infoTint border-info/30 text-blue-900',
    iconBox: 'bg-infoTint text-info',
    title: 'text-blue-900',
    message: 'text-blue-800',
    cta: 'bg-blue-600 hover:bg-blue-700 text-white',
    Icon: Lock,
  },
  warning: {
    wrapper: 'bg-amber-50 border-amber-200 text-amber-900',
    iconBox: 'bg-amber-100 text-amber-600',
    title: 'text-amber-900',
    message: 'text-amber-800',
    cta: 'bg-amber-600 hover:bg-amber-700 text-white',
    Icon: AlertTriangle,
  },
}

export default function CredentialMissingBanner({
  variant = 'warning',
  title,
  message,
  cta,
  ctaTo,
  next,
}: CredentialMissingBannerProps) {
  const styles = STYLES[variant] ?? STYLES.warning
  const { Icon } = styles

  const ctaLocation = ctaTo
    ? next
      ? { pathname: ctaTo, search: `?next=${encodeURIComponent(next)}` }
      : ctaTo
    : null

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-4 ${styles.wrapper}`}>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${styles.iconBox}`}>
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        {title ? <p className={`font-semibold ${styles.title}`}>{title}</p> : null}
        {message ? <p className={`text-sm mt-0.5 ${styles.message}`}>{message}</p> : null}
      </div>
      {cta && ctaLocation ? (
        <Link
          to={ctaLocation}
          className={`shrink-0 px-4 py-2 rounded-md text-sm font-semibold transition-colors ${styles.cta}`}
        >
          {cta}
        </Link>
      ) : null}
    </div>
  )
}
