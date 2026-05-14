'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Globe, Edit3, Clock, FileText, ExternalLink, Loader } from 'lucide-react'

interface PageItem {
  id: string
  slug: string
  title: string
  meta_description?: string
  is_published: boolean
  updated_at?: string
}

const pageLabel = (slug: string) => {
  const map: Record<string, string> = {
    '/': '首页',
    '/products': '产品',
    '/ai-chat': 'AI客服',
    '/knowledge': '每日知识',
    '/papers': '文献引用',
    '/points-mall': '积分商城',
    '/contact': '联系我们',
  }
  return map[slug] || slug
}

const pageUrl = (slug: string) => slug

export default function PagesListPage() {
  const [pages, setPages] = useState<PageItem[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  const loadPages = () => {
    setLoading(true)
    fetch('/api/admin/pages')
      .then((r) => r.json())
      .then((d: { pages?: PageItem[] }) => {
        setPages(d.pages || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  async function handleSeed() {
    setSeeding(true)
    try {
      const res = await fetch('/api/admin/pages/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        loadPages()
      } else {
        alert('初始化失败：' + (data.error || '未知错误'))
      }
    } catch (e) {
      alert('初始化失败')
    } finally {
      setSeeding(false)
    }
  }

  useEffect(() => {
    loadPages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatDate = (iso?: string) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Globe className="w-5 h-5 text-cyan-400" />
          内页管理
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          管理网站各页面的内容与布局，点击卡片进入可视化编辑器
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : pages.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 mb-4">暂无页面</p>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors disabled:opacity-50"
          >
            {seeding ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                初始化中...
              </>
            ) : (
              '初始化默认页面'
            )}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pages.map((page) => (
            <div
              key={page.id}
              className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-600 transition-colors"
            >
              {/* Thumbnail preview */}
              <div className="h-36 bg-slate-800/50 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2 group-hover:text-cyan-400 transition-colors" />
                    <span className="text-xs text-slate-500 font-mono">
                      {page.slug}
                    </span>
                  </div>
                </div>
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Link
                    href={`/admin/pages/${page.id}/editor`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors shadow-lg"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    编辑页面
                  </Link>
                </div>
              </div>

              {/* Card body */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {pageLabel(page.slug)}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {page.title}
                    </p>
                  </div>
                  {!page.is_published && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded">
                      草稿
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 mt-3 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(page.updated_at)}</span>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800">
                  <Link
                    href={`/admin/pages/${page.id}/editor`}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-200 rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    编辑
                  </Link>
                  <a
                    href={pageUrl(page.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg text-xs hover:text-white hover:bg-slate-700 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    访问
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
