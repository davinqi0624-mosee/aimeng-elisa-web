'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Flame,
  Eye,
  ThumbsUp,
  Star,
  BookOpen,
  Microscope,
  Wrench,
  AlertTriangle,
  FileText,
  Package,
  Loader2,
} from 'lucide-react'

interface KnowledgeItem {
  id: string
  date: string
  title: string
  summary: string
  content: string
  category: string
  tags: string[]
  is_hot: boolean
  is_featured: boolean
  quality_score: number
  view_count: number
  helpful_count: number
}

const CATEGORIES = [
  { value: '', label: '全部', icon: BookOpen },
  { value: '样本处理', label: '样本处理', icon: Microscope },
  { value: '操作技巧', label: '操作技巧', icon: Wrench },
  { value: 'Troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
  { value: '前沿文献', label: '前沿文献', icon: FileText },
  { value: '产品指南', label: '产品指南', icon: Package },
  { value: '标准曲线', label: '标准曲线', icon: Star },
  { value: '常见问题', label: '常见问题', icon: AlertTriangle },
  { value: 'ELISA原理', label: 'ELISA原理', icon: BookOpen },
]

export default function DailyKnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')

  useEffect(() => {
    loadItems()
  }, [activeCategory])

  async function loadItems() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('all', 'true')
      if (activeCategory) params.set('category', activeCategory)
      const res = await fetch(`/api/knowledge/daily?${params.toString()}`)
      const data = await res.json()
      setItems(data.items || [])
    } catch {
      setItems([])
    }
    setLoading(false)
  }

  const featured = items.find((i) => i.is_featured)
  const trending = items
    .filter((i) => !i.is_featured)
    .sort((a, b) => (b.view_count + b.helpful_count) - (a.view_count + a.helpful_count))
    .slice(0, 5)
  const regular = items.filter((i) => !i.is_featured && !trending.includes(i))

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">每日知识</h1>
          <p className="text-sm text-gray-500 mt-1">ELISA 实验技术知识库，持续进化中</p>
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon
            return (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors ${
                  activeCategory === cat.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat.label}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400">暂无内容</div>
        ) : (
          <>
            {/* Featured */}
            {featured && !activeCategory && (
              <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
                <div className="bg-amber-50 px-4 py-2 flex items-center gap-2 text-xs font-medium text-amber-700">
                  <Star className="w-3.5 h-3.5" />
                  今日精选
                </div>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <h2 className="text-lg font-bold text-gray-900 mb-2">{featured.title}</h2>
                      <p className="text-sm text-gray-600 mb-3">{featured.summary}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        <span className="px-2 py-0.5 bg-gray-100 rounded">{featured.category}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {featured.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {featured.helpful_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          质量 {(featured.quality_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/knowledge/article/${featured.id}`}
                      className="shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
                    >
                      阅读全文
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Trending */}
            {!activeCategory && trending.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-500" />
                  本周热门
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {trending.map((item) => (
                    <Link
                      key={item.id}
                      href={`/knowledge/article/${item.id}`}
                      className="bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm mb-1 truncate">
                            {item.title}
                          </h4>
                          <p className="text-xs text-gray-500 line-clamp-2">{item.summary}</p>
                        </div>
                        {item.is_hot && (
                          <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span>{item.category}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {item.view_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <ThumbsUp className="w-3 h-3" />
                          {item.helpful_count}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* All articles */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                {activeCategory || '全部文章'}
              </h3>
              <div className="space-y-3">
                {(activeCategory ? items : regular).map((item) => (
                  <Link
                    key={item.id}
                    href={`/knowledge/article/${item.id}`}
                    className="block bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                        <p className="text-sm text-gray-500 line-clamp-2">{item.summary}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400">
                        {item.is_hot && <Flame className="w-4 h-4 text-orange-500" />}
                        <span className="px-2 py-0.5 bg-gray-100 rounded">{item.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {item.view_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3 h-3" />
                        {item.helpful_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        {(item.quality_score * 100).toFixed(0)}%
                      </span>
                      <span>{new Date(item.date).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
