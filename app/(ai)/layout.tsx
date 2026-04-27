import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  MessageSquare,
  FileText,
  History,
  BarChart3,
  LogOut,
  FlaskConical,
} from 'lucide-react'

export default async function AiLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const navItems = [
    { href: '/chat', label: '智能客服', icon: MessageSquare },
    { href: '/documents', label: '知识库管理', icon: FileText },
    { href: '/history', label: '历史会话', icon: History },
    { href: '/dashboard', label: '数据看板', icon: BarChart3 },
  ]

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold text-lg">
            <FlaskConical className="w-6 h-6" />
            <span>艾萌 ELISA AI</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
            >
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 mb-2 truncate">{user.email}</div>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              退出登录
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
