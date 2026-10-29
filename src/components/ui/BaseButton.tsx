import type { ButtonHTMLAttributes } from 'react'

/**
 * App-wide primary button.
 *
 * Variants:
 *   * ``primary``     — main action / create / submit (brand accent).
 *   * ``secondary``   — confirming secondary action (resume, save in a
 *                       non-destructive context).
 *   * ``outline``     — bordered, low-emphasis action.
 *   * ``text``        — very subtle action (cancel in modals).
 *   * ``destructive`` — destructive action (delete, reject, reset).
 *   * ``solid``       — always-solid primary color (no soft default state);
 *                       for standalone CTAs like the login button.
 *
 * Disabled: all variants drop the hover effect and switch to
 * ``opacity-50 + cursor-not-allowed``, set centrally here.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'text' | 'destructive' | 'solid'

export interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brandAccentSoft text-brandAccent hover:bg-brandAccent hover:text-white focus:ring-brandAccent/60',
  secondary: 'bg-primarySoft text-gray-800 hover:bg-primary hover:text-white focus:ring-primary/60',
  outline:
    'bg-transparent text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-gray-400 focus:ring-gray-300 shadow-none',
  text: 'bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-300 shadow-none',
  destructive: 'bg-destructiveSoft text-destructive hover:bg-destructive hover:text-white focus:ring-destructive/60',
  solid: 'bg-primary text-onDark hover:bg-primaryDark focus:ring-primary/60',
}

export default function BaseButton({
  variant = 'primary',
  className,
  type = 'button',
  children,
  ...rest
}: BaseButtonProps) {
  const classes = [
    `ui-button ui-button--${variant}`,
    'inline-flex items-center justify-center gap-2',
    'font-medium text-sm transition duration-150 shadow-sm',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:hover:!bg-current',
    variant === 'solid' ? 'px-6 py-3 rounded-full' : 'px-5 py-2.5 rounded-xl',
    VARIANT_CLASSES[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
