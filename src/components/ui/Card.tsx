import type { HTMLAttributes } from 'react'

export default function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={['ui-card', className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  )
}
