'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ThumbsUp,
  Eye,
  Calendar,
  ChevronRight,
  Loader2,
  BookOpen,
} from 'lucide-react'

interface KnowledgeItem {
  id: string
  date: string
  title: string
  summary: string
  content: string
  category: string
  tags: string[]
  quality_score: number
  view_count: number
  helpful_count: number
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const diff = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function DailyKnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadItems()
  }, [])

  async function loadItems() {
    setLoading(true)
    try {
      const res = await fetch('/api/knowledge/daily?all=true')
      const data = await res.json()
      const sorted = (data.items || []).sort(
        (a: KnowledgeItem, b: KnowledgeItem) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
      )
      setItems(sorted)
    } catch {
      setItems([])
    }
    setLoading(false)
  }

  const today = new Date()
  const weekday = WEEKDAYS[today.getDay()]
  const dateStr = `${today.getMonth() + 1}月${today.getDate()}日`

  const featured = items[0]
  const pastItems = items.slice(1, 7)

  async function handleLike(e: React.MouseEvent, id: string) {
    e.preventDefault()
    try {
      await fetch('/api/knowledge/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledge_id: id, helpful: true }),
      })
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, helpful_count: item.helpful_count + 1 }
            : item
        )
      )
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top banner */}
      <div className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-3 text-gray-500 text-sm mb-2">
            <Calendar className="w-4 h-4" />
            <span>{dateStr} {weekday}</span>
            <span className="text-gray-300">|</span>
            <span>ELISA 每日一课</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">爱萌优宁 ELISA 知识库</h1>
          <p className="text-sm text-gray-500 mt-2">
            每日更新实验技巧、 troubleshooting 与前沿动态
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>暂无今日内容</p>
            <p className="text-xs mt-1">精彩内容即将上线</p>
          </div>
        ) : (
          <>
            {/* Featured - Today's article */}
            {featured && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="h-40 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                  <div className="text-center">
                    <div className="text-5xl font-bold">{today.getDate()}</div>
                    <div className="text-sm opacity-80 mt-1">{today.getMonth() + 1}月 · {weekday}</div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                      {featured.category}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Eye className="w-3 h-3" />
                      {featured.view_count} 阅读
                    </span>
                  </div>

                  <h2 className="text-xl font-bold text-gray-900 mb-2">{featured.title}</h2>
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {featured.summary}
                  </p>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={(e) => handleLike(e, featured.id)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition-colors"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      有用 {featured.helpful_count > 0 ? `(${featured.helpful_count})` : ''}
                    </button>
                    <Link
                      href={`/knowledge/article/${featured.id}`}
                      className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      阅读全文
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Past 6 days */}
            {pastItems.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  往期回顾
                </h3>
                <div className="space-y-3">
                  {pastItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/knowledge/article/${item.id}`}
                      className="block bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow"
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 w-14 text-center">
                          <div className="text-lg font-bold text-gray-900">
                            {new Date(item.date).getDate()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(item.date).getMonth() + 1}月
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm mb-1">
                            {item.title}
                          </h4>
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {item.summary}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                            <span className="px-2 py-0.5 bg-gray-100 rounded">
                              {item.category}
                            </span>
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {item.view_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <ThumbsUp className="w-3 h-3" />
                              {item.helpful_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* View all */}
            <div className="text-center">
              <Link
                href="/knowledge/archive"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
              >
                查看全部历史文章
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
