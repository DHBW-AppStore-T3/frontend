import type { ReactNode } from 'react'

export interface FormRowProps {
  icon: ReactNode
  label: string
  /** ``center`` for single-line controls, ``start`` for tall content. */
  align?: 'center' | 'start'
  /** `id` of the row's single control: the label is then a real `<label>` for it. */
  htmlFor?: string
  children: ReactNode
}

/** A labelled settings row (icon, bold label, control) of the add-app form. */
export default function FormRow({ icon, label, align = 'center', htmlFor, children }: FormRowProps) {
  const items = align === 'center' ? 'items-center' : 'items-start'
  const labelClass = `font-bold text-textHeading w-48 pl-2${align === 'start' ? ' mt-2' : ''}`
  return (
    <div className={`bg-surfaceMuted rounded-lg p-3 flex ${items} shadow-sm`}>
      <div className="p-2">{icon}</div>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <div className={labelClass}>{label}</div>
      )}
      {children}
    </div>
  )
}
