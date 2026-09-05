'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronDown, LogOut, Menu, Shield, X } from 'lucide-react'

interface NavbarProps {
  user?: {
    email?: string
    user_metadata?: {
      full_name?: string | null
    }
  } | null
  isAdmin?: boolean
}

const navGroups = [
  {
    label: 'AI中心',
    href: '/chat',
    items: [
      { href: '/chat', label: 'AI客服', description: '售前咨询、售后支持、实验问题解答' },
      { href: '/lab/experiment', label: '实验方案设计', description: '根据目标指标生成实验方案' },
    ],
  },
  {
    label: '产品中心',
    href: '/products/elisa',
    items: [
      { href: '/products/elisa', label: 'ELISA 试剂盒', description: '按货号、指标、种属、希腊字母检索' },
      { href: '/products/fbs', label: '胎牛血清', description: '查看 FBS 产品、质控参数和适用细胞' },
      { href: '/products/animal-serum', label: '动物血制品', description: '查看其他动物血清和血制品' },
      { href: '/products/biochemical-reagents', label: '其他生化检测试剂', description: '查看 WB、IHC 和生化检测相关试剂' },
      { href: '/products/coa', label: 'COA 查询', description: '按血清货号和批号查询质检报告' },
    ],
  },
  {
    label: '实验工具',
    href: '/lab/analysis',
    items: [
      { href: '/lab/analysis', label: '数据分析', description: '4PL 拟合、OD 换算、标准曲线' },
      { href: '/lab/calculator', label: '酶标板计算器', description: '常用实验计算辅助工具' },
    ],
  },
  {
    label: '知识社区',
    href: '/knowledge',
    items: [
      { href: '/knowledge', label: '每日知识', description: 'ELISA 知识和实验技巧' },
      { href: '/citations', label: '文献引用', description: '上传文献、获取积分、引用统计' },
      { href: '/community', label: '科研社区', description: '客户实验讨论与经验交流' },
    ],
  },
  {
    label: '积分商城',
    href: '/store',
    items: [
      { href: '/store', label: '积分商城', description: '积分兑换礼品和服务' },
      { href: '/member', label: '我的积分', description: '查看积分余额和兑换记录' },
      { href: '/member/purchase-points', label: '购买积分申请', description: '输入积分码并上传商品照片' },
    ],
  },
  {
    label: '联系我们',
    href: '/contact',
    items: [
      { href: '/contact', label: '联系我们', description: '官方客服、售前售后与公司联系方式' },
      { href: '/agents', label: '全国代理商', description: '查看各地区代理商联系方式' },
    ],
  },
]

export default function Navbar({ user, isAdmin }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 xl:px-8">
        <div className="grid h-16 grid-cols-[150px_1fr_auto] items-center gap-3 md:grid-cols-[160px_1fr_auto] xl:grid-cols-[180px_1fr_auto]">
          {/* Logo */}
          <Link
            href="/"
            aria-label="上海爱萌优宁生物技术有限公司官网首页"
            className="flex w-[150px] items-center justify-start overflow-hidden md:w-[160px] xl:w-[180px]"
          >
            <Image
              src="/brand/aimeng-logo.png"
              alt="上海爱萌优宁生物技术有限公司"
              width={1490}
              height={472}
              priority
              className="block h-auto w-full object-contain"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden min-w-0 items-center justify-center gap-0.5 md:flex">
            {navGroups.map((group) => (
              <div key={group.label} className="relative group">
                <Link
                  href={group.href}
                  className="flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 xl:px-3"
                >
                  {group.label}
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 transition-transform group-hover:rotate-180" />
                </Link>
                <div className="invisible absolute left-1/2 top-full z-50 w-72 -translate-x-1/2 pt-3 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                  <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-xl shadow-slate-900/10">
                    {group.items.map((item) => (
                      <Link
                        key={`${group.label}-${item.href}-${item.label}`}
                        href={item.href}
                        className="block rounded-md px-3 py-2.5 hover:bg-slate-50 transition-colors"
                      >
                        <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="hidden items-center justify-end gap-3 md:flex">
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
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-50 transition-colors"
                >
                  <LogOut className="w-3 h-3" />
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium text-white rounded-lg bg-slate-900 hover:bg-slate-800 transition-colors"
                >
                  注册
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  登录
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? '关闭移动端导航菜单' : '打开移动端导航菜单'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-site-nav"
            className="justify-self-end p-2 text-slate-600 hover:text-slate-900 md:hidden"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div id="mobile-site-nav" className="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-slate-200 bg-white/95 backdrop-blur-md md:hidden">
          <nav className="px-6 py-3 space-y-1">
            {navGroups.map((group) => (
              <div key={group.label} className="rounded-lg px-1 py-1">
                <Link
                  href={group.href}
                  onClick={() => setMobileOpen(false)}
                  className="block px-2 py-2 text-sm font-semibold text-slate-900"
                >
                  {group.label}
                </Link>
                <div className="grid gap-1 pl-3">
                  {group.items.map((item) => (
                    <Link
                      key={`${group.label}-${item.href}-${item.label}`}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
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
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 text-sm font-medium text-white rounded-lg bg-slate-900"
                  >
                    注册
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg"
                  >
                    登录
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
