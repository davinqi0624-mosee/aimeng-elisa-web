'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Package,
  Gift,
  ClipboardList,
  FileText,
  Users,
  ArrowRight,
} from 'lucide-react'

interface Stats {
  products: number
  shopItems: number
  orders: number
  pendingPapers: number
  users: number
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ products: 0, shopItems: 0, orders: 0, pendingPapers: 0, users: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/products').then((r) => r.json()),
      fetch('/api/admin/shop').then((r) => r.json()),
      fetch('/api/admin/orders').then((r) => r.json()),
      fetch('/api/papers?status=pending').then((r) => r.json()),
      fetch('/api/admin/users').then((r) => r.json()).catch(() => ({ users: [] })),
    ])
      .then(([products, shop, orders, papers, users]) => {
        setStats({
          products: products.products?.length || 0,
          shopItems: shop.items?.length || 0,
          orders: orders.orders?.length || 0,
          pendingPapers: papers.papers?.length || 0,
          users: users.users?.length || 0,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const cards = [
    { label: '商品', value: stats.products, href: '/admin/products', icon: <Package className="w-5 h-5 text-blue-600" />, color: 'bg-blue-50' },
    { label: '积分奖品', value: stats.shopItems, href: '/admin/shop', icon: <Gift className="w-5 h-5 text-pink-600" />, color: 'bg-pink-50' },
    { label: '兑换订单', value: stats.orders, href: '/admin/orders', icon: <ClipboardList className="w-5 h-5 text-amber-600" />, color: 'bg-amber-50' },
    { label: '待审核论文', value: stats.pendingPapers, href: '/admin/papers', icon: <FileText className="w-5 h-5 text-emerald-600" />, color: 'bg-emerald-50' },
    { label: '注册用户', value: stats.users, href: '/admin/users', icon: <Users className="w-5 h-5 text-purple-600" />, color: 'bg-purple-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">管理后台</h1>
        <p className="text-sm text-gray-500">概览与快捷入口</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {cards.map((card) => (
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
      )}
    </div>
  )
}
