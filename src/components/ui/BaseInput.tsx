import type { InputHTMLAttributes } from 'react'

export interface BaseInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string
  /** Receives the new string value (not the DOM event) — the React equivalent of `v-model`. */
  onChange?: (value: string) => void
}

export default function BaseInput({ value, onChange, type, className, ...rest }: BaseInputProps) {
  const classes = [
    'w-full rounded-xl border border-gray-300 px-4 py-2',
    'focus:outline-none focus:ring-2 focus:ring-primaryAction',
    'focus:border-primaryAction transition',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <input
      type={type || 'text'}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      className={classes}
      {...rest}
    />
  )
}
