import { useId, type InputHTMLAttributes, type ReactNode } from 'react'

export interface BaseInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string
  /** Receives the new string value (not the DOM event) — the React equivalent of `v-model`. */
  onChange?: (value: string) => void
  /**
   * Visible label, rendered above the field and tied to it with `htmlFor`/`id`.
   * Without one the caller names the field itself (`aria-label`, `aria-labelledby`).
   */
  label?: ReactNode
}

export default function BaseInput({ value, onChange, type, className, label, id, ...rest }: BaseInputProps) {
  const generatedId = useId()
  const inputId = id ?? (label ? generatedId : undefined)
  const classes = [
    'w-full rounded-xl border border-gray-300 px-4 py-2',
    'focus:outline-none focus:ring-2 focus:ring-primaryAction',
    'focus:border-primaryAction transition',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const input = (
    <input
      type={type || 'text'}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      className={classes}
      id={inputId}
      {...rest}
    />
  )

  if (!label) return input
  return (
    <>
      <label htmlFor={inputId} className="block text-sm font-medium text-textMuted mb-1.5">
        {label}
      </label>
      {input}
    </>
  )
}
