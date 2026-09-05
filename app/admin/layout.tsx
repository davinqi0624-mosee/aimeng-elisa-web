import { AntdRegistry } from '@ant-design/nextjs-registry'
import AdminLayoutClient from './AdminLayoutClient'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </AntdRegistry>
  )
}
