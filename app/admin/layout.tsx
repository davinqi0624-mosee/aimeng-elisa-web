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
  ChevronDown,
  BookOpen,
  Store,
  BarChart3,
} from 'lucide-react'

type AdminRole = 'super' | 'level1' | 'level2' | null

interface SubMenuItem {
  href: string
  label: string
}

interface MenuGroup {
  label: string
  icon: React.ReactNode
  roles: AdminRole[]
  items: SubMenuItem[]
}

const MENU_GROUPS: MenuGroup[] = [
  {
    label: '概览',
    icon: <LayoutDashboard className="w-4 h-4" />,
    roles: ['super', 'level1', 'level2'],
    items: [{ href: '/admin', label: '数据看板' }],
  },
  {
    label: '商品中心',
    icon: <Package className="w-4 h-4" />,
    roles: ['super', 'level1', 'level2'],
    items: [
      { href: '/admin/products', label: '商品管理' },
      { href: '/admin/orders', label: '兑换订单' },
    ],
  },
  {
    label: '积分运营',
    icon: <Gift className="w-4 h-4" />,
    roles: ['super', 'level1', 'level2'],
    items: [
      { href: '/admin/shop', label: '积分商城' },
      { href: '/admin/citations', label: '文献审核' },
    ],
  },
  {
    label: '知识管理',
    icon: <BookOpen className="w-4 h-4" />,
    roles: ['super', 'level1', 'level2'],
    items: [
      { href: '/admin/knowledge/candidates', label: '知识审核' },
    ],
  },
  {
    label: '用户中心',
    icon: <Users className="w-4 h-4" />,
    roles: ['super', 'level1'],
    items: [{ href: '/admin/users', label: '用户管理' }],
  },
  {
    label: '系统管理',
    icon: <Settings className="w-4 h-4" />,
    roles: ['super'],
    items: [{ href: '/admin/settings', label: '系统设置' }],
  },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [role, setRole] = useState<AdminRole>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/user/points')
      .then((r) => r.json())
      .then((d) => {
        setRole(d.role || null)
      })
      .catch(() => setRole(null))
      .finally(() => setLoading(false))
  }, [])

  // Auto-expand group containing current path
  useEffect(() => {
    const group = MENU_GROUPS.find((g) =>
      g.items.some((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    )
    if (group && !expandedGroups.includes(group.label)) {
      setExpandedGroups((prev) => [...prev, group.label])
    }
  }, [pathname])

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

  const visibleGroups = MENU_GROUPS.filter((g) => g.roles.includes(role))

  function toggleGroup(label: string) {
    setExpandedGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    )
  }

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
          {visibleGroups.map((group) => {
            const isExpanded = expandedGroups.includes(group.label)
            const hasActiveChild = group.items.some(
              (item) => pathname === item.href || pathname.startsWith(item.href + '/')
            )
            return (
              <div key={group.label}>
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors ${
                    hasActiveChild
                      ? 'text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {group.icon}
                    {group.label}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isExpanded && (
                  <div className="pb-1">
                    {group.items.map((item) => {
                      const active =
                        pathname === item.href || pathname.startsWith(item.href + '/')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-2 pl-10 pr-4 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                          }`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${
                              active ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                          />
                          {item.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
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
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/20"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute top-12 left-0 right-0 bg-white border-b border-gray-200 py-2 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {visibleGroups.map((group) => {
              const isExpanded = expandedGroups.includes(group.label)
              const hasActiveChild = group.items.some(
                (item) => pathname === item.href || pathname.startsWith(item.href + '/')
              )
              return (
                <div key={group.label}>
                  <button
                    onClick={() => toggleGroup(group.label)}
                    className={`w-full flex items-center justify-between px-4 py-2.5 text-sm ${
                      hasActiveChild ? 'text-blue-700 font-medium' : 'text-gray-600'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {group.icon}
                      {group.label}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isExpanded &&
                    group.items.map((item) => {
                      const active =
                        pathname === item.href || pathname.startsWith(item.href + '/')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-2 pl-10 pr-4 py-2 text-sm ${
                            active ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500'
                          }`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${
                              active ? 'bg-blue-500' : 'bg-gray-300'
                            }`}
                          />
                          {item.label}
                        </Link>
                      )
                    })}
                </div>
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
