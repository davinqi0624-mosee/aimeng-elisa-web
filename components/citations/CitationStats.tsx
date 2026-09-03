'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText } from 'lucide-react'

interface RecentPaper {
  title: string
  journal: string
  impact_factor: number
  publication_date: string
  verified_at?: string
  doi: string
  product_cat_no: string
  authors: string
  affiliation?: string
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
      suffix: '篇',
    },
    {
      label: '累计影响因子',
      value: stats.total_if,
      suffix: '',
    },
    {
      label: '最高单篇 IF',
      value: stats.max_single_if,
      sub: stats.max_single_journal || undefined,
      suffix: '',
    },
    {
      label: '本月新增',
      value: stats.monthly_growth,
      suffix: stats.monthly_growth > 0 ? '篇' : '',
      emptyText: stats.monthly_growth === 0 ? '待您投稿' : undefined,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {items.map((item) => (
            <div key={item.label} className="text-center">
              <p className="text-2xl md:text-3xl font-black text-[#0F766E]">
                {item.emptyText && item.value === 0
                  ? item.emptyText
                  : typeof item.value === 'number' && item.value % 1 !== 0
                    ? item.value.toFixed(1)
                    : item.value}
                {item.suffix && item.value !== 0 && <span className="text-sm font-bold text-[#0F766E] ml-1">{item.suffix}</span>}
              </p>
              <p className="text-xs font-semibold text-slate-700 mt-1">{item.label}</p>
              {item.sub && (
                <p className="text-[11px] text-slate-500 mt-1 truncate max-w-[180px] mx-auto">{item.sub}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent papers */}
      {stats.recent_papers && stats.recent_papers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-slate-900">最新收录</h3>
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
                className="bg-white/55 border border-slate-300/70 rounded-xl p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-[1px] hover:border-blue-300 transition-colors group"
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
