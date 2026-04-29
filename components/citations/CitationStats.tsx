'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, TrendingUp, Award, FileText, Microscope } from 'lucide-react'

interface RecentPaper {
  title: string
  journal: string
  impact_factor: number
  publication_date: string
  doi: string
  product_cat_no: string
  authors: string
}

interface Stats {
  total_citations: number
  total_if: number
  max_single_if: number
  max_single_journal: string
  monthly_growth: number
  recent_papers: RecentPaper[]
}

export default function CitationStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/citations/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!stats) return null

  const items = [
    {
      label: 'SCI 引用文献',
      value: stats.total_citations,
      icon: <Microscope className="w-5 h-5 text-blue-600" />,
      color: 'bg-blue-50',
      suffix: '篇',
    },
    {
      label: '累计影响因子',
      value: stats.total_if,
      icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
      color: 'bg-emerald-50',
      suffix: '',
    },
    {
      label: '最高单篇 IF',
      value: stats.max_single_if,
      icon: <Award className="w-5 h-5 text-amber-600" />,
      color: 'bg-amber-50',
      sub: stats.max_single_journal || undefined,
      suffix: '',
    },
    {
      label: '本月新增',
      value: stats.monthly_growth,
      icon: <BookOpen className="w-5 h-5 text-violet-600" />,
      color: 'bg-violet-50',
      suffix: '篇',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Big numbers */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 rounded-lg ${item.color}`}>{item.icon}</div>
              <span className="text-xs text-gray-400">{item.label}</span>
            </div>
            <p className="text-xl font-bold text-gray-900">
              {typeof item.value === 'number' && item.value % 1 !== 0
                ? item.value.toFixed(1)
                : item.value}
              <span className="text-sm font-normal text-gray-400 ml-1">{item.suffix}</span>
            </p>
            {item.sub && (
              <p className="text-xs text-gray-500 mt-1 truncate">{item.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Recent papers */}
      {stats.recent_papers && stats.recent_papers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">最近发表</h3>
            <Link
              href="/citations"
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              查看全部
              <FileText className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.recent_papers.slice(0, 3).map((p, i) => (
              <Link
                key={i}
                href={`/citations`}
                className="bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full font-medium">
                    {p.product_cat_no || '未知货号'}
                  </span>
                  <span className="text-xs text-amber-600 font-medium">
                    IF {p.impact_factor || '-'}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 line-clamp-2 mb-1 group-hover:text-indigo-700 transition-colors">
                  {p.title}
                </h4>
                <p className="text-xs text-gray-500 line-clamp-1">{p.journal}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {p.publication_date
                    ? new Date(p.publication_date).getFullYear()
                    : '-'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
