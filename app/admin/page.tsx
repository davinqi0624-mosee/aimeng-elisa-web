'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Package,
  Gift,
  ClipboardList,
  FileText,
  ArrowRight,
  TrendingUp,
  Archive,
  AlertTriangle,
  BookOpen,
  Shield,
} from 'lucide-react'

interface Stats {
  products: number
  shopItems: number
  orders: number
  pendingPapers: number
  todayProducts: number
  todayDatasheets: number
  inStock: number
  outOfStock: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    products: 0,
    shopItems: 0,
    orders: 0,
    pendingPapers: 0,
    todayProducts: 0,
    todayDatasheets: 0,
    inStock: 0,
    outOfStock: 0,
  })
  const [loading, setLoading] = useState(true)
  const [adminRole, setAdminRole] = useState<string>('admin')

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => setAdminRole(d.role || 'admin'))
      .catch(() => {})

    Promise.all([
      fetch('/api/admin/products').then((r) => r.json()),
      fetch('/api/admin/shop').then((r) => r.json()),
      fetch('/api/admin/orders').then((r) => r.json()),
      fetch('/api/admin/citations?status=pending').then((r) => r.json()),
      fetch('/api/admin/dashboard/stats').then((r) => r.json()).catch(() => ({
        todayProducts: 0, todayDatasheets: 0, inStock: 0, outOfStock: 0,
      })),
    ])
      .then(([products, shop, orders, papers, dash]) => {
        setStats({
          products: products.products?.length || 0,
          shopItems: shop.items?.length || 0,
          orders: orders.orders?.length || 0,
          pendingPapers: papers.papers?.length || 0,
          todayProducts: dash.todayProducts || 0,
          todayDatasheets: dash.todayDatasheets || 0,
          inStock: dash.inStock || 0,
          outOfStock: dash.outOfStock || 0,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const mainCards = [
    { label: '商品', value: stats.products, href: '/admin/products', icon: <Package className="w-5 h-5 text-blue-600" />, color: 'bg-blue-50' },
    { label: '积分奖品', value: stats.shopItems, href: '/admin/shop', icon: <Gift className="w-5 h-5 text-pink-600" />, color: 'bg-pink-50' },
    { label: '兑换订单', value: stats.orders, href: '/admin/orders', icon: <ClipboardList className="w-5 h-5 text-amber-600" />, color: 'bg-amber-50' },
    { label: '待审核论文', value: stats.pendingPapers, href: '/admin/citations', icon: <FileText className="w-5 h-5 text-emerald-600" />, color: 'bg-emerald-50' },
  ]

  const statCards = [
    {
      label: '今日上架',
      value: stats.todayProducts,
      icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
      color: 'bg-emerald-50',
      href: '/admin/products',
    },
    {
      label: '今日生成说明书',
      value: stats.todayDatasheets,
      icon: <BookOpen className="w-4 h-4 text-blue-600" />,
      color: 'bg-blue-50',
      href: '/datasheet',
    },
    {
      label: '现货库存',
      value: stats.inStock,
      icon: <Archive className="w-4 h-4 text-sky-600" />,
      color: 'bg-sky-50',
      href: '/admin/products',
    },
    {
      label: '缺货商品',
      value: stats.outOfStock,
      icon: <AlertTriangle className="w-4 h-4 text-orange-600" />,
      color: 'bg-orange-50',
      href: '/admin/products',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">管理后台</h1>
        <p className="text-sm text-gray-500">概览与快捷入口</p>
      </div>

      {adminRole === 'super' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">超级管理员模式</p>
            <p className="text-xs text-amber-700 mt-0.5">您可以访问所有功能，包括管理员管理和系统设置。</p>
          </div>
        </div>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-1.5 rounded-lg ${card.color}`}>{card.icon}</div>
                  <span className="text-xs text-gray-400">{card.label}</span>
                </div>
                <p className="text-xl font-bold text-gray-900">{card.value}</p>
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mainCards.map((card) => (
              <Link
                key={card.label}
                href={card.href}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
