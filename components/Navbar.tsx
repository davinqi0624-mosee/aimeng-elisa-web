'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X, FlaskConical } from 'lucide-react';

const navItems = [
  { label: '产品', href: '/products' },
  { label: 'AI客服', href: '/chat' },
  { label: '数据分析', href: '/analysis' },
  { label: '视频教程', href: '/videos' },
  { label: '每日知识', href: '/knowledge' },
  { label: '文献引用', href: '/publications' },
  { label: '积分商城', href: '/points' },
  { label: '科研社区', href: '/community' },
  { label: '联系我们', href: '/contact' },
  { label: '会员中心', href: '/member' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200/60">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#3CB5C0] to-[#2563EB] flex items-center justify-center shadow-sm">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-[#3CB5C0] to-[#2563EB] bg-clip-text text-transparent hidden sm:block">
            AIMENG UNING
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'text-blue-600 bg-blue-50'
                    : 'text-[#475569] hover:text-blue-600 hover:bg-blue-50/50'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>

        {/* Auth + Mobile Toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/login"
              className="px-4 py-2 rounded-full border border-[#cbd5e1] text-[#475569] text-sm font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-full text-sm font-medium text-white bg-gradient-to-r from-[#2563EB] to-[#0891B2] hover:shadow-lg transition-all"
            >
              注册
            </Link>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5 text-[#475569]" /> : <Menu className="w-5 h-5 text-[#475569]" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-100 bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-[#475569] hover:text-blue-600 hover:bg-blue-50/50'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-2 flex gap-2 md:hidden">
              <Link href="/login" className="flex-1 px-4 py-2 rounded-full border border-[#cbd5e1] text-center text-[#475569] text-sm font-medium">
                登录
              </Link>
              <Link href="/register" className="flex-1 px-4 py-2 rounded-full text-center text-sm font-medium text-white bg-gradient-to-r from-[#2563EB] to-[#0891B2]">
                注册
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
