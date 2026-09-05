'use client'

import { usePathname } from 'next/navigation'
import AntdProvider from '@/components/admin/AntdProvider'
import AdminShell from '@/components/admin/AdminShell'

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = pathname === '/admin/login'

  if (isLoginPage) {
    return <AntdProvider>{children}</AntdProvider>
  }

  return (
    <AntdProvider>
      <AdminShell>{children}</AdminShell>
    </AntdProvider>
  )
}
