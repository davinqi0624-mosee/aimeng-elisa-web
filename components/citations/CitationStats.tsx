'use client'

import { useState, useEffect } from 'react'
import { BookOpen, TrendingUp, Award, FileText } from 'lucide-react'

interface Stats {
  total_citations: number
  total_impact_factor: number
  max_single_if: number
  max_single_journal: string
  monthly_growth: number
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const items = [
    {
      label: '引用文献总数',
      value: stats.total_citations,
      icon: <FileText className="w-5 h-5 text-blue-600" />,
      color: 'bg-blue-50',
    },
    {
      label: '累计影响因子',
      value: stats.total_impact_factor,
      suffix: '',
      icon: <TrendingUp className="w-5 h-5 text-emerald-600" />,
      color: 'bg-emerald-50',
    },
    {
      label: '最高单篇 IF',
      value: stats.max_single_if,
      suffix: '',
      icon: <Award className="w-5 h-5 text-amber-600" />,
      color: 'bg-amber-50',
      sub: stats.max_single_journal || undefined,
    },
    {
      label: '本月新增',
      value: stats.monthly_growth,
      icon: <BookOpen className="w-5 h-5 text-violet-600" />,
      color: 'bg-violet-50',
    },
  ]

  return (
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
            {item.suffix || ''}
          </p>
          {item.sub && (
            <p className="text-xs text-gray-500 mt-1 truncate">{item.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}
