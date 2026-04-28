'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Gift,
  ClipboardList,
  FileText,
  Users,
  Shield,
  Settings,
  Menu,
  X,
} from 'lucide-react'

type AdminRole = 'super' | 'level1' | 'level2' | null

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: AdminRole[]
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: '概览', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['super', 'level1', 'level2'] },
  { href: '/admin/products', label: '商品管理', icon: <Package className="w-4 h-4" />, roles: ['super', 'level1', 'level2'] },
  { href: '/admin/shop', label: '积分商城', icon: <Gift className="w-4 h-4" />, roles: ['super', 'level1', 'level2'] },
  { href: '/admin/orders', label: '兑换订单', icon: <ClipboardList className="w-4 h-4" />, roles: ['super', 'level1', 'level2'] },
  { href: '/admin/papers', label: '积分审核', icon: <FileText className="w-4 h-4" />, roles: ['super', 'level1', 'level2'] },
  { href: '/admin/users', label: '用户管理', icon: <Users className="w-4 h-4" />, roles: ['super', 'level1'] },
  { href: '/admin/settings', label: '系统设置', icon: <Settings className="w-4 h-4" />, roles: ['super'] },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [role, setRole] = useState<AdminRole>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    fetch('/api/user/points')
      .then((r) => r.json())
      .then((d) => {
        setRole(d.role || null)
      })
      .catch(() => setRole(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!role || (role !== 'super' && role !== 'level1' && role !== 'level2')) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-red-400" />
        <h1 className="text-lg font-bold text-gray-900 mb-2">无权访问</h1>
        <p className="text-sm text-gray-500 mb-6">您没有管理员权限，无法进入后台管理页面。</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(role))

  return (
    <div className="flex h-full">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-white border-r border-gray-200">
        <div className="px-4 py-4 border-b border-gray-200">
          <Link href="/admin" className="flex items-center gap-2 text-gray-900 font-bold">
            <Shield className="w-5 h-5 text-blue-600" />
            管理后台
          </Link>
          <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700">
            {role === 'super' ? '超级管理员' : role === 'level1' ? 'L1 管理员' : 'L2 管理员'}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleNav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <Link href="/" className="text-xs text-gray-500 hover:text-gray-700">
            ← 返回网站首页
          </Link>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2 text-gray-900 font-bold text-sm">
          <Shield className="w-4 h-4 text-blue-600" />
          管理后台
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 text-gray-600">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/20" onClick={() => setMobileOpen(false)}>
          <div
            className="absolute top-12 left-0 right-0 bg-white border-b border-gray-200 py-2"
            onClick={(e) => e.stopPropagation()}
          >
            {visibleNav.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto pt-12 md:pt-0 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">{children}</div>
      </main>
    </div>
  )
}
