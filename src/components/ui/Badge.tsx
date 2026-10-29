import type { HTMLAttributes } from 'react'

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand'

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  bordered?: boolean
}

const VARIANT_CLASSES: Record<BadgeVariant, { base: string; border: string }> = {
  success: { base: 'bg-successTint text-success', border: ' border-success/30' },
  warning: { base: 'bg-warningTint text-warning', border: ' border-warning/30' },
  danger: { base: 'bg-dangerTint text-danger', border: ' border-danger/30' },
  info: { base: 'bg-infoTint text-info', border: ' border-info/30' },
  brand: { base: 'bg-brandAccentSoft text-brandAccent', border: ' border-brandAccent/30' },
  neutral: { base: 'bg-surfaceMuted text-textMuted', border: ' border-borderSubtle' },
}

export default function Badge({
  variant = 'neutral',
  bordered = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  const v = VARIANT_CLASSES[variant]
  const classes = [
    'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium',
    bordered ? 'border' : '',
    v.base + (bordered ? v.border : ''),
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  )
}
