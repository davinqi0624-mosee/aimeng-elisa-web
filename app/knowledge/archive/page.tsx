'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Search, Calendar, BookOpen, Loader2 } from 'lucide-react'

interface DailyKnowledge {
  id: string
  date: string
  title: string
  summary: string
  category: string
  tags: string[]
}

export default function ArchivePage() {
  const [items, setItems] = useState<DailyKnowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    fetch('/api/knowledge/daily?all=true')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)))

  const filtered = items.filter((item) => {
    const matchQ = !q || item.title.includes(q) || item.summary.includes(q)
    const matchCat = !category || item.category === category
    return matchQ && matchCat
  })

  const grouped: Record<string, DailyKnowledge[]> = {}
  filtered.forEach((item) => {
    const month = item.date.slice(0, 7)
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(item)
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">历史知识归档</h1>
      <p className="text-sm text-gray-500 mb-6">浏览所有 ELISA 每日知识文章</p>

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索标题或摘要..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">所有分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.keys(grouped)
            .sort((a, b) => b.localeCompare(a))
            .map((month) => (
              <div key={month}>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-semibold text-gray-700">{month}</h2>
                </div>
                <div className="space-y-2">
                  {grouped[month].map((item) => (
                    <Link
                      key={item.id}
                      href={`/knowledge/${item.date}`}
                      className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{item.title}</div>
                          <div className="text-xs text-gray-500 mt-1 line-clamp-1">{item.summary}</div>
                        </div>
                        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded-full">
                          <BookOpen className="w-3 h-3" />
                          {item.category}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">没有找到匹配的文章</div>
          )}
        </div>
      )}
    </div>
  )
}
