'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Gift,
  FileText,
  BookOpen,
  Shield,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

interface AdminData {
  id: string
  username: string
  role: 'super' | 'admin'
  display_name: string
  permissions: string[]
}

interface MenuItem {
  href: string
  label: string
  icon: React.ReactNode
  roles: ('super' | 'admin')[]
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/admin', label: '仪表盘', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/products', label: '商品管理', icon: <Package className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/shop', label: '积分审核', icon: <Gift className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/citations', label: '文献审核', icon: <FileText className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/datasheet', label: '说明书生成', icon: <BookOpen className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/admins', label: '管理员管理', icon: <Users className="w-4 h-4" />, roles: ['super'] },
  { href: '/admin/settings', label: '系统设置', icon: <Settings className="w-4 h-4" />, roles: ['super'] },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [admin, setAdmin] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const isLoginPage = pathname === '/admin/login'

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false)
      return
    }

    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.push('/admin/login')
        } else {
          setAdmin(data)
        }
      })
      .catch(() => router.push('/admin/login'))
      .finally(() => setLoading(false))
  }, [router, isLoginPage])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
  }

  if (isLoginPage) {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-[#0b1120]">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!admin) return null

  const visibleItems = MENU_ITEMS.filter((item) => item.roles.includes(admin.role))

  return (
    <div className="flex h-screen bg-[#0b1120]">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-[#0f172a] border-r border-slate-800">
        <div className="px-4 py-4 border-b border-slate-800">
          <Link href="/admin" className="flex items-center gap-2 text-white font-bold">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
              <Shield className="w-4 h-4 text-white" />
            </div>
            管理后台
          </Link>
          <div className="mt-3 flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
              admin.role === 'super'
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
            }`}>
              {admin.role === 'super' ? '超级管理员' : '管理员'}
            </span>
            <span className="text-xs text-slate-400 truncate">{admin.display_name}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {visibleItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors rounded-md mx-2 ${
                  active
                    ? 'bg-cyan-500/10 text-cyan-400 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link href="/" className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← 返回网站首页
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors w-full"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出登录
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-[#0f172a] border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2 text-white font-bold text-sm">
          <div className="w-6 h-6 rounded bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          管理后台
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 text-slate-400">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-12 left-0 right-0 bg-[#0f172a] border-b border-slate-800 py-2" onClick={(e) => e.stopPropagation()}>
            {visibleItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                    active ? 'bg-cyan-500/10 text-cyan-400 font-medium' : 'text-slate-400'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
            <div className="border-t border-slate-800 mt-2 pt-2 px-4">
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-400">
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto pt-12 md:pt-0 bg-[#0b1120]">
        <div className="max-w-6xl mx-auto px-4 py-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  )
}
