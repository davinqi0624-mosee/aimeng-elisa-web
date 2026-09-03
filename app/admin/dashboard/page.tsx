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
  const [cleanupFilter, setCleanupFilter] = useState<'all' | 'delete' | 'review'>('all')
  const [cleanupResult, setCleanupResult] = useState<{
    mode: 'preview' | 'delete'
    deleteScope?: 'recommended' | 'all'
    totalFiles: number
    referencedFiles: number
    orphanedFiles: number
    recommendedDeleteFiles?: number
    reviewRequiredFiles?: number
    deletedFiles: number
    deletedByBucket: Record<string, number>
    orphanFiles?: Array<{
      bucket: string
      path: string
      publicUrl: string
      fileName: string
      riskLevel: 'low' | 'medium'
      recommendation: 'delete' | 'review'
      confidence: number
      actionLabel: string
      reason: string
    }>
    orphanPreviewLimit?: number
    checkedReferenceSources?: string[]
    warning?: string
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
      fetch('/api/admin/products?pageSize=1').then((r) => r.json()),
      fetch('/api/admin/shop').then((r) => r.json()),
      fetch('/api/admin/orders?limit=1').then((r) => r.json()),
      fetch('/api/admin/citations?status=pending').then((r) => r.json()),
      fetch('/api/admin/dashboard/stats').then((r) => r.json()).catch(() => ({
        todayProducts: 0, todayDatasheets: 0, inStock: 0, outOfStock: 0,
      })),
    ])
      .then(([products, shop, orders, papers, dash]) => {
        setStats({
          products: products.total ?? products.products?.length ?? 0,
          shopItems: shop.items?.length || 0,
          orders: orders.total ?? orders.orders?.length ?? 0,
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

  const handleCleanupScan = async () => {
    setCleaning(true)
    setCleanupFilter('all')
    try {
      const res = await fetch('/api/admin/storage-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmDelete: false }),
      })
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

  const handleCleanupDelete = async () => {
    const recommendedCount = cleanupResult?.recommendedDeleteFiles || 0
    if (!cleanupResult || recommendedCount === 0) return
    const confirmed = confirm(
      `即将删除系统建议可删除的 ${recommendedCount} 个低风险 Storage 文件。\n\n需要人工确认的文件会保留，不会被本次操作删除。此操作不可撤销，是否继续？`
    )
    if (!confirmed) return

    setCleaning(true)
    try {
      const res = await fetch('/api/admin/storage-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmDelete: true, deleteScope: 'recommended' }),
      })
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

  const cleanupFiles = cleanupResult?.orphanFiles || []
  const filteredCleanupFiles = cleanupFiles.filter((file) => {
    if (cleanupFilter === 'all') return true
    return file.recommendation === cleanupFilter
  })

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
                  <p className="text-xs text-gray-500 mt-0.5">先扫描预览，再二次确认删除。默认不会直接清理文件。</p>
                </div>
                <button
                  onClick={handleCleanupScan}
                  disabled={cleaning}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg text-sm hover:bg-blue-100 disabled:opacity-50"
                >
                  {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  {cleaning ? '扫描中...' : '扫描可清理文件'}
                </button>
              </div>
              {cleanupResult && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-center md:grid-cols-6">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-gray-900">{cleanupResult.totalFiles}</div>
                      <div className="text-[10px] text-gray-500">Storage 总文件</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-emerald-700">{cleanupResult.referencedFiles}</div>
                      <div className="text-[10px] text-emerald-600">数据库引用数</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-amber-700">{cleanupResult.orphanedFiles}</div>
                      <div className="text-[10px] text-amber-600">疑似未引用</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-orange-700">{cleanupResult.recommendedDeleteFiles || 0}</div>
                      <div className="text-[10px] text-orange-600">系统建议删除</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-slate-700">{cleanupResult.reviewRequiredFiles || 0}</div>
                      <div className="text-[10px] text-slate-500">人工确认</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <div className="text-lg font-bold text-red-600">{cleanupResult.deletedFiles}</div>
                      <div className="text-[10px] text-red-500">本次已删除</div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-semibold">{cleanupResult.warning || '当前仅为扫描结果。'}</p>
                        <p className="mt-1">
                          “系统建议删除”主要是临时文件、备份文件等低风险项；“人工确认”会保留，需要管理员确认用途后再处理。
                          如果文件被手工写死在页面、外部链接、富文本内容或新功能字段中，系统可能无法识别。
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-xs font-semibold text-gray-900">扫描后的操作</p>
                      <p className="mt-1 text-xs text-gray-500">
                        当前可删除 {cleanupResult.recommendedDeleteFiles || 0} 个；需人工确认 {cleanupResult.reviewRequiredFiles || 0} 个。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleCleanupDelete}
                        disabled={cleaning || cleanupResult.mode !== 'preview' || (cleanupResult.recommendedDeleteFiles || 0) === 0}
                        title={(cleanupResult.recommendedDeleteFiles || 0) === 0 ? '当前没有系统建议删除的低风险文件' : '只删除系统建议删除的低风险文件'}
                        className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        {cleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        删除系统建议文件
                      </button>
                      <button
                        onClick={() => setCleanupFilter('review')}
                        disabled={(cleanupResult.reviewRequiredFiles || 0) === 0}
                        title={(cleanupResult.reviewRequiredFiles || 0) === 0 ? '当前没有需要人工确认的文件' : '只查看需要人工确认的文件'}
                        className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-600 hover:bg-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <FileText className="w-4 h-4" />
                        查看人工确认文件
                      </button>
                    </div>
                  </div>

                  {cleanupResult.checkedReferenceSources && (
                    <details className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                      <summary className="cursor-pointer font-medium text-gray-800">本次已检查的引用来源</summary>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {cleanupResult.checkedReferenceSources.map((source) => (
                          <li key={source}>{source}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {cleanupResult.orphanFiles && cleanupResult.orphanFiles.length > 0 && (
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold text-gray-800">疑似未引用文件预览</p>
                          {[
                            { value: 'all' as const, label: '全部' },
                            { value: 'delete' as const, label: '建议删除' },
                            { value: 'review' as const, label: '人工确认' },
                          ].map((item) => (
                            <button
                              key={item.value}
                              onClick={() => setCleanupFilter(item.value)}
                              className={`rounded px-2 py-1 text-[10px] font-medium ${
                                cleanupFilter === item.value
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-white text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {item.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-gray-500">
                          显示 {filteredCleanupFiles.length} 条，最多返回 {cleanupResult.orphanPreviewLimit || cleanupResult.orphanFiles.length} 条
                        </p>
                      </div>
                      <div className="max-h-72 divide-y divide-gray-100 overflow-auto bg-white">
                        {filteredCleanupFiles.map((file) => (
                          <div key={`${file.bucket}/${file.path}`} className="px-3 py-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{file.bucket}</span>
                              <span className={`rounded px-2 py-0.5 font-medium ${
                                file.recommendation === 'delete'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}>
                                {file.actionLabel}
                              </span>
                              <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600">
                                置信度 {file.confidence}%
                              </span>
                              <span className="font-mono text-gray-800 break-all">{file.path}</span>
                              <a
                                href={file.publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-600 hover:bg-blue-100"
                              >
                                打开文件
                              </a>
                            </div>
                            <p className="mt-1 text-gray-500">{file.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {cleanupResult.orphanedFiles === 0 && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      本次扫描没有发现疑似未引用文件，所以删除和人工确认按钮处于不可操作状态。
                    </div>
                  )}
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
