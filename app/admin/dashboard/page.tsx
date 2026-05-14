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
  Trash2,
  Loader2,
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

  // Storage cleanup state
  const [cleaning, setCleaning] = useState(false)
  const [cleanupResult, setCleanupResult] = useState<{
    totalFiles: number
    referencedFiles: number
    orphanedFiles: number
    deletedFiles: number
    deletedByBucket: Record<string, number>
  } | null>(null)

  // Fix slugs state
  const [fixingSlugs, setFixingSlugs] = useState(false)
  const [fixSlugsResult, setFixSlugsResult] = useState<{ fixed: number; message: string } | null>(null)

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
    { label: '今日上架', value: stats.todayProducts, icon: <TrendingUp className="w-4 h-4 text-emerald-600" />, color: 'bg-emerald-50', href: '/admin/products' },
    { label: '今日生成说明书', value: stats.todayDatasheets, icon: <BookOpen className="w-4 h-4 text-blue-600" />, color: 'bg-blue-50', href: '/datasheet' },
    { label: '现货库存', value: stats.inStock, icon: <Archive className="w-4 h-4 text-sky-600" />, color: 'bg-sky-50', href: '/admin/products' },
    { label: '缺货商品', value: stats.outOfStock, icon: <AlertTriangle className="w-4 h-4 text-orange-600" />, color: 'bg-orange-50', href: '/admin/products' },
  ]

  const handleCleanup = async () => {
    if (!confirm('确定清理未引用的存储文件吗？此操作不可撤销。')) return
    setCleaning(true)
    try {
      const res = await fetch('/api/admin/storage-cleanup', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setCleanupResult(data)
      } else {
        alert('清理失败: ' + (data.error || '未知错误'))
      }
    } catch {
      alert('清理请求失败')
    } finally {
      setCleaning(false)
    }
  }

  const handleFixSlugs = async () => {
    if (!confirm('确定为所有缺失 slug 的产品自动生成 slug 吗？')) return
    setFixingSlugs(true)
    setFixSlugsResult(null)
    try {
      const res = await fetch('/api/admin/products/fix-slugs', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setFixSlugsResult(data)
      } else {
        alert('修复失败: ' + (data.error || '未知错误'))
      }
    } catch {
      alert('修复请求失败')
    } finally {
      setFixingSlugs(false)
    }
  }

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
              <Link key={card.label} href={card.href} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
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
              <Link key={card.label} href={card.href} className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${card.color}`}>{card.icon}</div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </Link>
            ))}
          </div>

          {adminRole === 'super' && (
            <>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">存储空间清理</h3>
                  <p className="text-xs text-gray-500 mt-0.5">删除数据库中未引用的 Storage 文件（孤儿文件）</p>
                </div>
                <button
                  onClick={handleCleanup}
                  disabled={cleaning}
                  className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 disabled:opacity-50"
                >
                  {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {cleaning ? '清理中...' : '开始清理'}
                </button>
              </div>
              {cleanupResult && (
                <div className="mt-4 grid grid-cols-4 gap-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-gray-900">{cleanupResult.totalFiles}</div>
                    <div className="text-[10px] text-gray-500">Storage 总文件</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-emerald-700">{cleanupResult.referencedFiles}</div>
                    <div className="text-[10px] text-emerald-600">已引用文件</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-amber-700">{cleanupResult.orphanedFiles}</div>
                    <div className="text-[10px] text-amber-600">孤儿文件</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <div className="text-lg font-bold text-red-600">{cleanupResult.deletedFiles}</div>
                    <div className="text-[10px] text-red-500">已删除</div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">修复缺失 Slug</h3>
                  <p className="text-xs text-gray-500 mt-0.5">为数据库中缺少 slug 的产品自动生成唯一 slug（修复 404）</p>
                </div>
                <button
                  onClick={handleFixSlugs}
                  disabled={fixingSlugs}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-50"
                >
                  {fixingSlugs ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {fixingSlugs ? '修复中...' : '一键修复'}
                </button>
              </div>
              {fixSlugsResult && (
                <div className="mt-4 bg-emerald-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-emerald-700">{fixSlugsResult.fixed}</div>
                  <div className="text-[10px] text-emerald-600">{fixSlugsResult.message}</div>
                </div>
              )}
            </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
