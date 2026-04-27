'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  BookOpen,
  Flame,
  Loader2,
} from 'lucide-react'

interface DailyKnowledge {
  id: string
  date: string
  title: string
  summary: string
  category: string
  tags: string[]
  is_hot?: boolean
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function KnowledgePage() {
  const [now, setNow] = useState(new Date())
  const [items, setItems] = useState<DailyKnowledge[]>([])
  const [loading, setLoading] = useState(true)
  const year = now.getFullYear()
  const month = now.getMonth()

  useEffect(() => {
    fetch('/api/knowledge/daily')
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items || [])
      })
      .finally(() => setLoading(false))
  }, [])

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const todayKey = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())

  const itemMap = new Map<string, DailyKnowledge>()
  items.forEach((item) => itemMap.set(item.date, item))

  const prevMonth = () => setNow(new Date(year, month - 1, 1))
  const nextMonth = () => setNow(new Date(year, month + 1, 1))

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">每日 ELISA 知识</h1>
          <p className="text-sm text-gray-500 mt-1">每天学习一点 ELISA 专业知识</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <button onClick={prevMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-900 min-w-[80px] text-center">
            {year}年{month + 1}月
          </span>
          <button onClick={nextMonth} className="p-1 hover:bg-gray-100 rounded">
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : (
        <>
          {/* Today Highlight */}
          {itemMap.get(todayKey) && (
            <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-semibold text-blue-700">今日知识</span>
              </div>
              <Link
                href={`/knowledge/${todayKey}`}
                className="text-lg font-bold text-gray-900 hover:text-blue-600 transition-colors"
              >
                {itemMap.get(todayKey)!.title}
              </Link>
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                {itemMap.get(todayKey)!.summary}
              </p>
            </div>
          )}

          {/* Calendar Grid */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
              {weekDays.map((d) => (
                <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-28 border-b border-r border-gray-100 bg-gray-50/50" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateKey = formatDateKey(year, month, day)
                const item = itemMap.get(dateKey)
                const isToday = dateKey === todayKey
                return (
                  <div
                    key={day}
                    className={`h-28 border-b border-r border-gray-100 p-2 transition-colors ${
                      isToday ? 'bg-blue-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isToday ? 'text-blue-600' : 'text-gray-700'}`}>
                      {day}
                    </div>
                    {item ? (
                      <Link
                        href={`/knowledge/${item.date}`}
                        className="block text-xs text-gray-800 hover:text-blue-600 leading-snug"
                      >
                        <span className="inline-flex items-center gap-1 mb-0.5">
                          <BookOpen className="w-3 h-3 text-blue-500" />
                          {item.is_hot && <Flame className="w-3 h-3 text-orange-500" />}
                        </span>
                        <span className="line-clamp-2 font-medium">{item.title}</span>
                        <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded">
                          {item.category}
                        </span>
                      </Link>
                    ) : (
                      <div className="text-[10px] text-gray-300 mt-4 text-center">暂无内容</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
