import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react'

interface Article {
  id: string
  title: string
  publish_date: string
  category: string
}

export default async function KnowledgeCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams

  const now = new Date()
  const [yearStr, monthStr] = month
    ? month.split('-')
    : [String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0')]
  const year = parseInt(yearStr)
  const monthIndex = parseInt(monthStr) - 1

  const firstDayOfMonth = new Date(year, monthIndex, 1)
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startDayOfWeek = firstDayOfMonth.getDay()

  const prevMonth = new Date(year, monthIndex - 1, 1)
  const nextMonth = new Date(year, monthIndex + 1, 1)
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`

  const monthLabel = firstDayOfMonth.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  })

  // Query articles for this month
  const startDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
  const endDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

  const supabase = await createClient()

  // Query both tables and merge — daily_knowledge takes precedence
  const { data: baseArticles } = await supabase
    .from('knowledge_base')
    .select('id, title, publish_date, category')
    .gte('publish_date', startDate)
    .lte('publish_date', endDate)
    .eq('is_published', true)
    .order('publish_date', { ascending: true })

  const { data: dailyArticles } = await supabase
    .from('daily_knowledge')
    .select('id, title, date, category')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })

  const articleMap = new Map<string, Article>()
  ;(baseArticles || []).forEach((a) => {
    articleMap.set(a.publish_date, { id: a.id, title: a.title, publish_date: a.publish_date, category: a.category })
  })
  ;(dailyArticles || []).forEach((a) => {
    articleMap.set(a.date, { id: a.id, title: a.title, publish_date: a.date, category: a.category })
  })

  const todayStr = new Date().toISOString().split('T')[0]

  // Build calendar grid
  const cells: {
    date: number
    dateStr: string
    isCurrentMonth: boolean
    article?: Article
    isToday: boolean
  }[] = []

  // Padding days from previous month
  const daysInPrevMonth = new Date(year, monthIndex, 0).getDate()
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const prevMonthIndex = monthIndex === 0 ? 11 : monthIndex - 1
    const prevYear = monthIndex === 0 ? year - 1 : year
    cells.push({
      date: d,
      dateStr: `${prevYear}-${String(prevMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
      isToday: false,
    })
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({
      date: d,
      dateStr,
      isCurrentMonth: true,
      article: articleMap.get(dateStr),
      isToday: dateStr === todayStr,
    })
  }

  // Padding days to fill the grid
  const remaining = (7 - (cells.length % 7)) % 7
  for (let d = 1; d <= remaining; d++) {
    const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1
    const nextYear = monthIndex === 11 ? year + 1 : year
    cells.push({
      date: d,
      dateStr: `${nextYear}-${String(nextMonthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      isCurrentMonth: false,
      isToday: false,
    })
  }

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-blue-600" />
              每日知识
            </h1>
            <p className="text-gray-500 mt-1">ELISA 专业知识日历</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/knowledge?month=${prevMonthStr}`}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <span className="text-lg font-semibold text-gray-900 min-w-[120px] text-center">
              {monthLabel}
            </span>
            <Link
              href={`/knowledge?month=${nextMonthStr}`}
              className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:text-blue-600 hover:border-blue-300 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {weekDays.map((day) => (
              <div
                key={day}
                className="px-3 py-3 text-center text-sm font-medium text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => (
              <div
                key={idx}
                className={`min-h-[100px] border-b border-r border-gray-100 p-2 transition-colors ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${
                      cell.isToday
                        ? 'bg-blue-600 text-white'
                        : cell.isCurrentMonth
                        ? 'text-gray-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {cell.date}
                  </span>
                  {cell.article && (
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                  )}
                </div>

                {cell.article ? (
                  <Link
                    href={`/knowledge/${cell.dateStr}`}
                    className="block mt-1 group"
                  >
                    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 group-hover:bg-blue-100 transition-colors line-clamp-2">
                      {cell.article.title}
                    </span>
                  </Link>
                ) : cell.isCurrentMonth ? (
                  <span className="text-xs text-gray-300">暂无文章</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>已发布</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-600 text-white text-xs">
              今
            </span>
            <span>今天</span>
          </div>
        </div>
      </div>
    </div>
  )
}
