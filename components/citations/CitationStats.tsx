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

interface CitationStatsProps {
  initialStats?: Stats
}

export default function CitationStats({ initialStats }: CitationStatsProps) {
  const [stats, setStats] = useState<Stats | null>(initialStats || null)
  const [loading, setLoading] = useState(!initialStats)

  useEffect(() => {
    if (initialStats) return
    fetch('/api/citations/stats')
      .then((r) => r.json())
      .then((data) => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [initialStats])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />
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
    <div className="space-y-6">
      {/* Gradient stats bar */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-50 via-emerald-50 to-violet-50 border border-slate-200 p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <div className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-3`}>
                {item.icon}
              </div>
              <p className="text-3xl md:text-4xl font-black text-gradient">
                {typeof item.value === 'number' && item.value % 1 !== 0
                  ? item.value.toFixed(1)
                  : item.value}
                {item.suffix && <span className="text-lg font-bold text-slate-400 ml-1">{item.suffix}</span>}
              </p>
              <p className="text-sm font-medium text-slate-600 mt-1">{item.label}</p>
              {item.sub && (
                <p className="text-xs text-slate-400 mt-1 truncate max-w-[200px] mx-auto">{item.sub}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent papers */}
      {stats.recent_papers && stats.recent_papers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">最近发表</h3>
            <Link
              href="/citations"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              查看全部
              <FileText className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats.recent_papers.slice(0, 3).map((p, i) => (
              <Link
                key={i}
                href={`/citations`}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:border-blue-300 transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-semibold">
                    {p.product_cat_no || '未知货号'}
                  </span>
                  <span className="text-xs text-amber-600 font-bold">
                    IF {p.impact_factor || '-'}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 line-clamp-2 mb-2 group-hover:text-blue-700 transition-colors">
                  {p.title}
                </h4>
                <p className="text-xs text-slate-500 line-clamp-1">{p.journal}</p>
                <p className="text-xs text-slate-400 mt-2">
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
