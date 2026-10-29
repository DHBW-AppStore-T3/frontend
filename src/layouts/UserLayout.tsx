import type { ReactNode } from 'react'
import AppLayout from './AppLayout'

export default function UserLayout({ children }: { children?: ReactNode }) {
  return <AppLayout>{children}</AppLayout>
}
