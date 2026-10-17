import type { ReactNode } from 'react'

export interface FormRowProps {
  icon: ReactNode
  label: string
  /** ``center`` for single-line controls, ``start`` for tall content. */
  align?: 'center' | 'start'
  children: ReactNode
}

/** A labelled settings row (icon, bold label, control) of the add-app form. */
export default function FormRow({ icon, label, align = 'center', children }: FormRowProps) {
  const items = align === 'center' ? 'items-center' : 'items-start'
  return (
    <div className={`bg-surfaceMuted rounded-lg p-3 flex ${items} shadow-sm`}>
      <div className="p-2">{icon}</div>
      <div className={`font-bold text-textHeading w-48 pl-2${align === 'start' ? ' mt-2' : ''}`}>{label}</div>
      {children}
    </div>
  )
}
