'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  Gift,
  FileText,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  MapPin,
  History,
  BookOpen,
  Activity,
  Bot,
  Beaker,
  ImagePlus,
  KeyRound,
  Ticket,
  Video,
  ClipboardList,
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
  permission?: string
}

const MENU_ITEMS: MenuItem[] = [
  { href: '/admin', label: '仪表盘', icon: <LayoutDashboard className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/products', label: '商品管理', icon: <Package className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/biochemical-products', label: '生化法试剂盒', icon: <Beaker className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/serum-products', label: '血清产品', icon: <Beaker className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/agents', label: '代理商管理', icon: <MapPin className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/home-banners', label: '首页广告位', icon: <ImagePlus className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/home-media', label: '自媒体内容', icon: <Video className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/datasheet', label: '说明书生成', icon: <FileText className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/product-documents', label: '产品文档', icon: <FileText className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/product-assets', label: '产品图片', icon: <ImagePlus className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/ai-agents', label: 'Agent 中台', icon: <Bot className="w-4 h-4" />, roles: ['super'] },
  { href: '/admin/knowledge/generate', label: '每日知识生成', icon: <BookOpen className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/knowledge/candidates', label: '知识候选审核', icon: <BookOpen className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/bulk-imports', label: '批量导入记录', icon: <History className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/shop', label: '积分商城', icon: <Gift className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/orders', label: '兑换订单', icon: <ClipboardList className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/purchase-points', label: '购买积分审核', icon: <Ticket className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/citations', label: '文献引用审核', icon: <FileText className="w-4 h-4" />, roles: ['super', 'admin'] },
  { href: '/admin/maintenance', label: '运维中心', icon: <Activity className="w-4 h-4" />, roles: ['super'] },
  { href: '/admin/ai-keys', label: 'AI密钥管理', icon: <KeyRound className="w-4 h-4" />, roles: ['super'] },
  { href: '/admin/users', label: '用户管理', icon: <Users className="w-4 h-4" />, roles: ['super', 'admin'], permission: 'user_manage' },
  { href: '/admin/admins', label: '管理员管理', icon: <Users className="w-4 h-4" />, roles: ['super'] },
  { href: '/admin/settings', label: '系统设置', icon: <Settings className="w-4 h-4" />, roles: ['super'] },
]

function isActiveMenuItem(pathname: string, href: string) {
  if (href === '/admin') {
    return pathname === '/admin' || pathname === '/admin/dashboard'
  }
  return pathname === href || pathname.startsWith(href + '/')
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isLoginPage = pathname === '/admin/login'
  const [admin, setAdmin] = useState<AdminData | null>(null)
  const [loading, setLoading] = useState(!isLoginPage)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (isLoginPage) {
      return
    }

    fetch('/api/admin/me', { cache: 'no-store' })
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

  const visibleItems = MENU_ITEMS.filter((item) => {
    if (!item.roles.includes(admin.role)) return false
    if (admin.role === 'super' || !item.permission) return true
    return admin.permissions.includes(item.permission)
  })

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col bg-slate-900 border-r border-slate-800">
        <div className="px-4 py-4 border-b border-slate-800">
          <Link href="/admin" className="flex items-center gap-2 text-white font-bold">
            <Image
              src="/brand/admin-a-logo.svg"
              alt="AIMENG UNING"
              width={34}
              height={28}
              className="h-8 w-9 object-contain"
              priority
            />
            AIMENG UNING
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
            const active = isActiveMenuItem(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors mx-2 rounded-lg ${
                  active
                    ? 'bg-slate-800 text-white font-medium border-l-2 border-cyan-400'
                    : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          <Link href="/admin/change-password" className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors">
            <KeyRound className="w-3.5 h-3.5" />
            修改密码
          </Link>
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
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <Link href="/admin" className="flex items-center gap-2 text-white font-bold text-sm">
          <Image
            src="/brand/admin-a-logo.svg"
            alt="AIMENG UNING"
            width={30}
            height={24}
            className="h-7 w-8 object-contain"
            priority
          />
          管理后台
        </Link>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 text-slate-400">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileOpen(false)}>
          <div className="absolute top-12 left-0 right-0 bg-slate-900 border-b border-slate-800 py-2" onClick={(e) => e.stopPropagation()}>
            {visibleItems.map((item) => {
              const active = isActiveMenuItem(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
                    active ? 'bg-slate-800 text-white font-medium border-l-2 border-cyan-400' : 'text-slate-400'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              )
            })}
            <div className="border-t border-slate-800 mt-2 pt-2 px-4">
              <Link href="/admin/change-password" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 text-sm text-slate-400 py-2">
                <KeyRound className="w-4 h-4" />
                修改密码
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-slate-400">
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto pt-12 md:pt-0 bg-slate-950">
        <div className={pathname.startsWith('/admin/pages/') && pathname.endsWith('/editor') ? 'h-full' : 'max-w-6xl mx-auto px-4 py-6 md:py-8'}>
          {children}
        </div>
      </main>
    </div>
  )
}
