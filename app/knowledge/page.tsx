import { createClient } from '@/lib/supabase/server'
import DynamicBlocks from '@/components/DynamicBlocks'
import { getCalendarDayMeta, getCalendarSeason, type CalendarSeason } from '@/lib/knowledge/calendar-meta'
import KnowledgeCalendarClient, { type CalendarArticle, type CalendarCell } from './KnowledgeCalendarClient'

interface SourceArticle {
  id: string
  title: string
  publish_date?: string
  date?: string
  category: string | null
  summary?: string | null
  view_count?: number | null
}

export default async function KnowledgeCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string }>
}) {
  const { month, category } = await searchParams

  const now = new Date()
  const [yearStr, monthStr] = month
    ? month.split('-')
    : [String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0')]
  const year = parseInt(yearStr, 10)
  const monthIndex = parseInt(monthStr, 10) - 1

  const firstDayOfMonth = new Date(year, monthIndex, 1)
  const lastDayOfMonth = new Date(year, monthIndex + 1, 0)
  const daysInMonth = lastDayOfMonth.getDate()
  const startDayOfWeek = firstDayOfMonth.getDay()

  const prevMonth = new Date(year, monthIndex - 1, 1)
  const nextMonth = new Date(year, monthIndex + 1, 1)
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`
  const nextMonthStr = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`
  const season: CalendarSeason = getCalendarSeason(monthIndex + 1)

  const monthLabel = firstDayOfMonth.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
  })

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const startDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`
  const monthEndDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`
  const endDate = monthEndDate < todayStr ? monthEndDate : todayStr

  const supabase = await createClient()

  const [baseResult, dailyResult, recentResult, hotResult, categoriesResult, pageResult] = await Promise.all([
    supabase
      .from('knowledge_base')
      .select('id, title, publish_date, category, summary')
      .gte('publish_date', startDate)
      .lte('publish_date', endDate)
      .eq('is_published', true)
      .order('publish_date', { ascending: true }),
    supabase
      .from('daily_knowledge')
      .select('id, title, date, category, summary, view_count')
      .gte('date', startDate)
      .lte('date', endDate)
      .eq('lifecycle_status', 'active')
      .order('date', { ascending: true }),
    supabase
      .from('daily_knowledge')
      .select('id, title, date, category, summary')
      .eq('lifecycle_status', 'active')
      .lte('date', todayStr)
      .order('date', { ascending: false })
      .limit(3),
    supabase
      .from('daily_knowledge')
      .select('id, title, date, category, summary, view_count')
      .eq('lifecycle_status', 'active')
      .lte('date', todayStr)
      .order('view_count', { ascending: false })
      .limit(3),
    supabase
      .from('daily_knowledge')
      .select('category')
      .eq('lifecycle_status', 'active'),
    supabase
      .from('pages')
      .select('blocks, is_published')
      .eq('id', 'knowledge')
      .single(),
  ])

  const articleMap = new Map<string, CalendarArticle>()

  ;((baseResult.data || []) as SourceArticle[]).forEach((article) => {
    const date = article.publish_date
    if (!date) return
    articleMap.set(date, {
      id: article.id,
      title: article.title,
      date,
      category: article.category || 'ELISA 知识',
      summary: article.summary || '点击查看当天 ELISA 专业知识内容。',
      href: `/knowledge/${date}`,
    })
  })

  ;((dailyResult.data || []) as SourceArticle[]).forEach((article) => {
    const date = article.date
    if (!date) return
    articleMap.set(date, {
      id: article.id,
      title: article.title,
      date,
      category: article.category || 'ELISA 知识',
      summary: article.summary || '点击查看当天 ELISA 专业知识内容。',
      viewCount: article.view_count || 0,
      href: `/knowledge/${date}`,
    })
  })

  const cells: CalendarCell[] = []

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

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const article = articleMap.get(dateStr)
    cells.push({
      date: d,
      dateStr,
      isCurrentMonth: true,
      article: !category || article?.category === category ? article : undefined,
      isToday: dateStr === todayStr,
      meta: getCalendarDayMeta(dateStr),
    })
  }

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

  const toCalendarArticle = (article: SourceArticle): CalendarArticle => {
    const date = article.date || article.publish_date || todayStr
    return {
      id: article.id,
      title: article.title,
      date,
      category: article.category || 'ELISA 知识',
      summary: article.summary || '点击查看这篇实验知识内容。',
      viewCount: article.view_count || 0,
      href: `/knowledge/${date}`,
    }
  }

  const recentArticles = ((recentResult.data || []) as SourceArticle[]).map(toCalendarArticle)
  const hotArticles = ((hotResult.data || []) as SourceArticle[]).map(toCalendarArticle)
  const categoryOptions = Array.from(
    new Set(((categoriesResult.data || []) as { category?: string | null }[]).map((item) => item.category).filter(Boolean) as string[])
  ).slice(0, 8)
  const seasonalTerms = Array.from(
    new Set(
      cells
        .filter((cell) => cell.isCurrentMonth && cell.meta?.solarTerm)
        .map((cell) => cell.meta?.solarTerm)
        .filter(Boolean) as string[]
    )
  )
  const seasonalFestivals = Array.from(
    new Set(
      cells
        .filter((cell) => cell.isCurrentMonth && cell.meta?.festival)
        .map((cell) => cell.meta?.festival)
        .filter(Boolean) as string[]
    )
  )

  const pageData = pageResult.data
  const hasDynamicContent =
    pageData?.is_published &&
    pageData?.blocks &&
    ((Array.isArray(pageData.blocks) && pageData.blocks.length > 0) ||
      (typeof pageData.blocks === 'object' &&
        !Array.isArray(pageData.blocks) &&
        'version' in pageData.blocks))

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {hasDynamicContent && <DynamicBlocks blocks={pageData?.blocks} />}
      <KnowledgeCalendarClient
        cells={cells}
        monthLabel={monthLabel}
        prevMonth={prevMonthStr}
        nextMonth={nextMonthStr}
        currentMonth={currentMonthStr}
        selectedMonth={`${year}-${String(monthIndex + 1).padStart(2, '0')}`}
        selectedCategory={category || ''}
        season={season}
        seasonalTerms={seasonalTerms}
        seasonalFestivals={seasonalFestivals}
        categories={categoryOptions}
        recentArticles={recentArticles}
        hotArticles={hotArticles}
      />
    </div>
  )
}
