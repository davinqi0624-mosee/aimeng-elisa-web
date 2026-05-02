'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FlaskConical, Menu, X, Shield, LogOut } from 'lucide-react'

interface NavbarProps {
  user?: {
    email?: string
    user_metadata?: {
      full_name?: string
    }
  } | null
  isAdmin?: boolean
}

const navLinks = [
  { href: '/search', label: '产品' },
  { href: '/chat', label: 'AI客服' },
  { href: '/knowledge', label: '每日知识' },
  { href: '/citations', label: '文献引用' },
  { href: '/store', label: '积分商城' },
]

export default function Navbar({ user, isAdmin }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center">
              <FlaskConical className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-gradient font-black text-lg tracking-tight">Animal Union</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  href="/member"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {user.user_metadata?.full_name || user.email}
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    后台
                  </Link>
                )}
                <button
                  onClick={async () => {
                    await fetch('/api/auth/signout', { method: 'POST' })
                    window.location.href = '/'
                  }}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  登录
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-500 hover:opacity-90 transition-opacity"
                >
                  注册
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md">
          <nav className="px-6 py-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-slate-100 mt-2 space-y-2">
              {user ? (
                <>
                  <Link
                    href="/member"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-slate-700"
                  >
                    会员中心
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="block px-3 py-2 text-sm font-medium text-amber-600"
                    >
                      管理后台
                    </Link>
                  )}
                  <button
                    onClick={async () => {
                      await fetch('/api/auth/signout', { method: 'POST' })
                      window.location.href = '/'
                    }}
                    className="block w-full text-left px-3 py-2 text-sm text-red-500"
                  >
                    退出登录
                  </button>
                </>
              ) : (
                <div className="flex gap-2 px-3">
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg"
                  >
                    登录
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-500"
                  >
                    注册
                  </Link>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
