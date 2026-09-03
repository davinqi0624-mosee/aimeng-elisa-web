'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Beaker,
  BookOpen,
  CalendarDays,
  CloudSun,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FlaskConical,
  Leaf,
  Microscope,
  Search,
  Snowflake,
  Sparkles,
  Sun,
  X,
} from 'lucide-react'
import type { CalendarDayMeta, CalendarSeason } from '@/lib/knowledge/calendar-meta'

export interface CalendarArticle {
  id: string
  title: string
  date: string
  category: string
  summary: string
  href: string
  viewCount?: number
}

export interface CalendarCell {
  date: number
  dateStr: string
  isCurrentMonth: boolean
  article?: CalendarArticle
  isToday: boolean
  meta?: CalendarDayMeta
}

interface Props {
  cells: CalendarCell[]
  monthLabel: string
  prevMonth: string
  nextMonth: string
  currentMonth: string
  selectedMonth: string
  selectedCategory: string
  season: CalendarSeason
  seasonalTerms: string[]
  seasonalFestivals: string[]
  categories: string[]
  recentArticles: CalendarArticle[]
  hotArticles: CalendarArticle[]
}

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const preferredCategories = ['细胞培养', '标准曲线', '操作技巧', 'Troubleshooting']

const seasonThemes: Record<
  CalendarSeason,
  {
    label: string
    description: string
    icon: typeof Leaf
    iconClass: string
    badgeClass: string
    heroClass: string
    patternClass: string
    articleCellClass: string
    articleCellHoverClass: string
    articleTextClass: string
  }
> = {
  spring: {
    label: '春生实验季',
    description: '万物复苏，适合从基础操作和样本准备开始建立稳定的实验节奏。',
    icon: Leaf,
    iconClass: 'text-emerald-600',
    badgeClass: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    heroClass: 'border-emerald-100 from-emerald-50/80 via-white to-cyan-50/70',
    patternClass: 'bg-[radial-gradient(circle_at_12px_12px,#36b37e_1.2px,transparent_1.2px)]',
    articleCellClass: 'bg-[#edf8f3]',
    articleCellHoverClass: 'hover:bg-[#dff1e8]',
    articleTextClass: 'text-emerald-700',
  },
  summer: {
    label: '夏日实验季',
    description: '光照和温度变化更明显，重点关注样本稳定性、孵育环境与实验节奏。',
    icon: Sun,
    iconClass: 'text-amber-500',
    badgeClass: 'border-amber-100 bg-amber-50 text-amber-700',
    heroClass: 'border-cyan-100 from-cyan-50/80 via-white to-amber-50/70',
    patternClass: 'bg-[linear-gradient(135deg,rgba(22,119,255,0.08)_25%,transparent_25%,transparent_50%,rgba(22,119,255,0.08)_50%,rgba(22,119,255,0.08)_75%,transparent_75%)]',
    articleCellClass: 'bg-[#edf7fb]',
    articleCellHoverClass: 'hover:bg-[#d8eef6]',
    articleTextClass: 'text-cyan-700',
  },
  autumn: {
    label: '秋收数据季',
    description: '把实验细节沉淀成可靠数据，适合复盘标准曲线、重复性和结果判读。',
    icon: CloudSun,
    iconClass: 'text-orange-500',
    badgeClass: 'border-orange-100 bg-orange-50 text-orange-700',
    heroClass: 'border-orange-100 from-orange-50/80 via-white to-amber-50/70',
    patternClass: 'bg-[radial-gradient(circle_at_8px_8px,#f59e0b_1px,transparent_1px)]',
    articleCellClass: 'bg-[#fff7ed]',
    articleCellHoverClass: 'hover:bg-[#ffedd5]',
    articleTextClass: 'text-orange-700',
  },
  winter: {
    label: '冬藏复盘季',
    description: '沉淀方法、整理记录，为下一轮实验做好试剂、流程和数据准备。',
    icon: Snowflake,
    iconClass: 'text-blue-600',
    badgeClass: 'border-blue-100 bg-blue-50 text-blue-700',
    heroClass: 'border-blue-100 from-blue-50/80 via-white to-slate-100/80',
    patternClass: 'bg-[radial-gradient(circle_at_10px_10px,#60a5fa_1px,transparent_1px)]',
    articleCellClass: 'bg-[#f1f6fc]',
    articleCellHoverClass: 'hover:bg-[#e3edf8]',
    articleTextClass: 'text-blue-700',
  },
}

function monthHref(month: string, category?: string) {
  const params = new URLSearchParams({ month })
  if (category) params.set('category', category)
  return `/knowledge?${params.toString()}`
}

function categoryHref(month: string, category: string) {
  if (!category) return `/knowledge?month=${month}`
  return `/knowledge?month=${month}&category=${encodeURIComponent(category)}`
}

function ArticleList({ items, emptyText }: { items: CalendarArticle[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{emptyText}</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link key={`${item.id}-${item.date}`} href={item.href} className="group block rounded-md border border-slate-100 bg-white px-3 py-2.5 transition hover:border-blue-200 hover:bg-blue-50/50">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="line-clamp-1 text-sm font-semibold text-slate-800 group-hover:text-blue-700">{item.title}</p>
              <p className="mt-1 text-xs text-slate-400">{item.date} · {item.category}</p>
            </div>
            {typeof item.viewCount === 'number' && item.viewCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                <Eye className="h-3 w-3" />
                {item.viewCount}
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}

function SeasonalVideoPanel({
  src,
  title,
  description,
}: {
  src: string
  title: string
  description: string
}) {
  return (
    <aside className="sticky top-24 hidden xl:block">
      <div className="relative h-[620px] overflow-hidden rounded-lg border border-white/80 bg-white shadow-sm shadow-slate-200/80">
        <video
          className="h-full w-full object-cover"
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            event.currentTarget.playbackRate = 0.5
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-white/55" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="rounded-md border border-white/70 bg-white/72 px-4 py-3 shadow-sm backdrop-blur-md">
            <p className="text-sm font-bold text-slate-900">{title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

export default function KnowledgeCalendarClient({
  cells,
  monthLabel,
  prevMonth,
  nextMonth,
  currentMonth,
  selectedMonth,
  selectedCategory,
  season,
  seasonalTerms,
  seasonalFestivals,
  categories,
  recentArticles,
  hotArticles,
}: Props) {
  const [previewArticle, setPreviewArticle] = useState<CalendarArticle | null>(null)
  const theme = seasonThemes[season]
  const SeasonIcon = theme.icon

  const publishedCount = useMemo(() => cells.filter((cell) => cell.isCurrentMonth && cell.article).length, [cells])
  const visibleCategories = useMemo(() => {
    const available = Array.from(new Set(categories))
    const preferred = preferredCategories.filter((category) => available.includes(category))
    return [...preferred, ...available.filter((category) => !preferred.includes(category))].slice(0, 8)
  }, [categories])

  const calendarStats = [
    {
      label: '本月发布',
      value: publishedCount,
      hint: '篇知识内容',
      accent: 'emerald',
    },
    {
      label: '节气提示',
      value: seasonalTerms.length,
      hint: seasonalTerms.length > 0 ? seasonalTerms[0] : '随月份更新',
      accent: 'blue',
    },
    {
      label: '节日标记',
      value: seasonalFestivals.length,
      hint: seasonalFestivals.length > 0 ? seasonalFestivals[0] : '无特殊节日',
      accent: 'rose',
    },
    {
      label: '可筛选分类',
      value: visibleCategories.length,
      hint: '个主题标签',
      accent: 'slate',
    },
  ] as const

  return (
    <main className="relative overflow-hidden">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-80 bg-[size:32px_32px] opacity-[0.12] ${theme.patternClass}`} />

      <section className="relative mx-auto max-w-[1720px] px-4 py-8 sm:px-6 lg:py-10 2xl:px-8">
        <div className={`mx-auto mb-7 max-w-6xl overflow-hidden rounded-lg border bg-gradient-to-br shadow-sm shadow-slate-200/70 ${theme.heroClass}`}>
          <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-7">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 ${theme.badgeClass}`}>
                  <SeasonIcon className={`h-3.5 w-3.5 ${theme.iconClass}`} />
                  {theme.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-blue-700">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {seasonalTerms.length > 0 ? seasonalTerms.join(' · ') : '节气随月份更新'}
                </span>
                {seasonalFestivals.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2.5 py-1 text-rose-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    {seasonalFestivals.slice(0, 2).join(' · ')}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-normal text-slate-950 sm:text-3xl">
                每日知识｜ELISA专业知识日历
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                每日一条实验干货，覆盖 ELISA、细胞培养、试剂选型、实验排坑，跟着日历学习，解决实验踩坑难题。
              </p>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">{theme.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center md:w-72">
              <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-3">
                <Microscope className="mx-auto mb-2 h-5 w-5 text-blue-600" />
                <p className="text-xs text-slate-500">实验排坑</p>
              </div>
              <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-3">
                <Beaker className="mx-auto mb-2 h-5 w-5 text-emerald-600" />
                <p className="text-xs text-slate-500">试剂选型</p>
              </div>
              <div className="rounded-lg border border-white/80 bg-white/70 px-3 py-3">
                <FlaskConical className="mx-auto mb-2 h-5 w-5 text-cyan-600" />
                <p className="text-xs text-slate-500">操作技巧</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(220px,1fr)_minmax(0,980px)_minmax(220px,1fr)] 2xl:grid-cols-[minmax(240px,1fr)_minmax(0,1040px)_minmax(240px,1fr)]">
          <SeasonalVideoPanel
            src="/knowledge/spring-summer-transition.mp4"
            title="春夏交替"
            description="把实验节律交给光影变化，提示样本稳定性与孵育条件。"
          />

          <div className="min-w-0">
            <div className="mb-5 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white/95 px-4 py-4 shadow-sm shadow-slate-200/60 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">Knowledge calendar</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{monthLabel}</h2>
                <p className="mt-1 text-sm text-slate-500">本月已发布 {publishedCount} 篇知识内容</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={monthHref(prevMonth, selectedCategory)}
                  aria-label="上个月"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Link>
                <Link
                  href={monthHref(currentMonth, selectedCategory)}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  回到今天
                </Link>
                <Link
                  href={monthHref(nextMonth, selectedCategory)}
                  aria-label="下个月"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {calendarStats.map((item) => (
                <div key={item.label} className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-500">{item.label}</p>
                    <span
                      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-xs font-semibold ${
                        item.accent === 'emerald'
                          ? 'bg-emerald-50 text-emerald-700'
                          : item.accent === 'blue'
                            ? 'bg-blue-50 text-blue-700'
                            : item.accent === 'rose'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-slate-50 text-slate-700'
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{item.hint}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={categoryHref(selectedMonth, '')}
                className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition ${
                  selectedCategory ? 'border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700' : 'border-blue-200 bg-blue-600 text-white'
                }`}
              >
                全部内容
              </Link>
              {visibleCategories.map((category) => (
                <Link
                  key={category}
                  href={categoryHref(selectedMonth, category)}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm transition ${
                    selectedCategory === category
                      ? 'border-emerald-200 bg-emerald-600 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700'
                  }`}
                >
                  {category}
                </Link>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80">
                {weekDays.map((day) => (
                  <div key={day} className="px-2 py-3 text-center text-sm font-semibold text-slate-500 sm:px-3">
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7">
                {cells.map((cell, idx) => {
                  const isPublished = Boolean(cell.article)
                  return (
                    <button
                      key={`${cell.dateStr}-${idx}`}
                      type="button"
                      onClick={() => cell.article && setPreviewArticle(cell.article)}
                      disabled={!cell.article}
                      className={`group relative min-h-[96px] border-b border-r border-slate-100 p-2 text-left transition duration-150 sm:min-h-[116px] sm:p-2.5 ${
                        idx % 7 === 6 ? 'border-r-0' : ''
                      } ${cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/60'} ${
                        isPublished ? `${theme.articleCellClass} ${theme.articleCellHoverClass} hover:-translate-y-0.5 hover:shadow-sm` : 'cursor-default'
                      } ${cell.isToday ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''}`}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                            cell.isToday
                              ? 'bg-blue-600 text-white shadow-sm'
                              : cell.isCurrentMonth
                                ? 'text-slate-700'
                                : 'text-slate-400'
                          }`}
                        >
                          {cell.date}
                        </span>
                        {isPublished && <span className="h-2.5 w-2.5 rounded-full bg-[#36b37e] shadow-[0_0_0_4px_rgba(54,179,126,0.14)]" />}
                      </div>

                      {(cell.meta?.solarTerm || cell.meta?.festival) && (
                        <div className="mb-1 flex flex-wrap gap-1">
                          {cell.meta.solarTerm && (
                            <span className={`rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium ${theme.articleTextClass}`}>
                              {cell.meta.solarTerm}
                            </span>
                          )}
                          {cell.meta.festival && (
                            <span className="rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-600">
                              {cell.meta.festival}
                            </span>
                          )}
                        </div>
                      )}

                      {cell.article ? (
                        <div className="rounded-md border border-white/80 bg-white/85 px-2.5 py-2 transition group-hover:border-white group-hover:bg-white">
                          <p className={`line-clamp-2 text-xs font-bold leading-5 sm:text-sm ${theme.articleTextClass}`}>
                            {cell.article.title}
                          </p>
                        </div>
                      ) : cell.isCurrentMonth ? (
                        <span className="mt-2 inline-flex rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-300">待更新</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-[#36b37e]" />
                已发布文章
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">今</span>
                今天
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-500">
                <span className="h-2 w-2 rounded-full bg-slate-200" />
                待更新
              </span>
            </div>

            <section className="mt-8 grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-blue-600" />
                  <h3 className="font-bold text-slate-900">最近更新</h3>
                </div>
                <ArticleList items={recentArticles} emptyText="暂无最近更新内容" />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900">热门干货</h3>
                </div>
                <ArticleList items={hotArticles} emptyText="暂无热门内容统计" />
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <Search className="h-5 w-5 text-cyan-600" />
                  <h3 className="font-bold text-slate-900">知识分类快速筛选</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {visibleCategories.map((category) => (
                    <Link
                      key={`card-${category}`}
                      href={categoryHref(selectedMonth, category)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      {category}
                    </Link>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-400">
                  可按实验问题、细胞培养、试剂选型和故障排查查看对应日期内容。
                </p>
              </div>
            </section>
          </div>

          <SeasonalVideoPanel
            src="/knowledge/autumn-winter-transition.mp4"
            title="秋冬交替"
            description="用温度与季节变化强化复盘感，让知识日历更像持续生长的实验记录。"
          />
        </div>
      </section>

      {previewArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6" onClick={() => setPreviewArticle(null)}>
          <div className="w-full max-w-lg rounded-lg bg-white shadow-2xl shadow-slate-900/20" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-medium text-blue-600">{previewArticle.date} · {previewArticle.category}</p>
                <h3 className="mt-2 text-lg font-bold leading-7 text-slate-950">{previewArticle.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewArticle(null)}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="关闭预览"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className="text-sm leading-7 text-slate-600">{previewArticle.summary}</p>
              <Link
                href={previewArticle.href}
                className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                阅读全文
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
