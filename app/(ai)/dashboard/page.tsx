'use client'

import { useState, useEffect } from 'react'
import {
  MessageSquare,
  TrendingUp,
  BarChart3,
  PieChart,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react'

interface DashboardData {
  totalSessions: number
  totalMessages: number
  modeDistribution: Record<string, number>
  dailyStats: Record<string, number>
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/ai/dashboard')
      .then((res) => res.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setData(d)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      </div>
    )
  }

  const dailyDates = Object.keys(data?.dailyStats || {}).sort()
  const dailyValues = dailyDates.map((d) => data?.dailyStats[d] || 0)
  const maxDaily = Math.max(...dailyValues, 1)

  const modeEntries = Object.entries(data?.modeDistribution || {})
  const totalModes = modeEntries.reduce((sum, [, v]) => sum + v, 0) || 1

  const modeColors: Record<string, string> = {
    'pre-sales': 'bg-blue-500',
    'after-sales': 'bg-emerald-500',
    protocol: 'bg-violet-500',
  }

  const modeLabels: Record<string, string> = {
    'pre-sales': '售前咨询',
    'after-sales': '售后支持',
    protocol: '实验方案',
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">数据看板</h1>
        <p className="text-sm text-gray-500 mt-1">AI 客服使用数据统计与分析</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{data?.totalSessions || 0}</div>
              <div className="text-xs text-gray-500">总会话数</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{data?.totalMessages || 0}</div>
              <div className="text-xs text-gray-500">总提问数</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{dailyDates.length}</div>
              <div className="text-xs text-gray-500">活跃天数（近14天）</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Activity Chart */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">日活跃趋势（近14天）</h2>
          </div>
          {dailyDates.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">暂无数据</div>
          ) : (
            <div className="space-y-2">
              {dailyDates.map((date) => {
                const value = data?.dailyStats[date] || 0
                const pct = (value / maxDaily) * 100
                return (
                  <div key={date} className="flex items-center gap-3">
                    <div className="w-16 text-xs text-gray-500">{date.slice(5)}</div>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-6 text-xs text-gray-700 text-right">{value}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mode Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-gray-600" />
            <h2 className="font-semibold text-gray-900">模式分布</h2>
          </div>
          {modeEntries.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">暂无数据</div>
          ) : (
            <div className="space-y-3">
              {modeEntries.map(([mode, count]) => {
                const pct = (count / totalModes) * 100
                return (
                  <div key={mode}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700">{modeLabels[mode] || mode}</span>
                      <span className="text-gray-500">
                        {count} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${modeColors[mode] || 'bg-gray-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
