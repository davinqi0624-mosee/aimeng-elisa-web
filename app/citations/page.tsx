'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import CitationStats from '@/components/citations/CitationStats'
import { ExternalLink, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface Paper {
  id: string
  title: string
  authors: string
  affiliation: string
  journal: string
  doi: string
  link: string
  impact_factor: number
  publication_date: string
  product_cat_no: string
  journal_cover_url: string
  detected_products: string[]
  products: { name: string; target: string; slug: string; cat_no: string } | null
}

const SORT_OPTIONS = [
  { value: 'newest', label: '最新收录' },
  { value: 'oldest', label: '最早发表' },
  { value: 'highest_if', label: '影响因子高→低' },
  { value: 'lowest_if', label: '影响因子低→高' },
]

const IF_RANGES = [
  { value: '', label: '全部 IF' },
  { value: '0-5', label: 'IF < 5' },
  { value: '5-10', label: '5 ≤ IF < 10' },
  { value: '10-20', label: '10 ≤ IF < 20' },
  { value: '20-999', label: 'IF ≥ 20' },
]

const YEAR_OPTIONS = [
  { value: '', label: '全部年份' },
  { value: '2025', label: '2025' },
  { value: '2024', label: '2024' },
  { value: '2023', label: '2023' },
  { value: '2022', label: '2022' },
  { value: '2021', label: '2021' },
]

function getPaperCatNos(paper: Paper) {
  if (Array.isArray(paper.detected_products) && paper.detected_products.length > 0) {
    return paper.detected_products
  }
  return (paper.product_cat_no || '')
    .split(/[,，、\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function getPaperAffiliation(paper: Paper) {
  return paper.affiliation || '单位待补充'
}

export default function CitationsPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [sort, setSort] = useState('newest')
  const [journalFilter, setJournalFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [ifRange, setIfRange] = useState('')
  const [year, setYear] = useState('')
  const [productFilter, setProductFilter] = useState('')

  async function load(currentPage = page) {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(currentPage))
    params.set('limit', '20')
    params.set('sort', sort)
    if (journalFilter) params.set('journal', journalFilter)
    if (productFilter) params.set('product', productFilter)
    if (ifRange) {
      const [min, max] = ifRange.split('-')
      params.set('min_if', min)
      params.set('max_if', max)
    }
    if (year) params.set('year', year)

    try {
      const res = await fetch(`/api/citations?${params.toString()}`)
      const data = await res.json()
      setPapers(data.papers || [])
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
    } catch {
      setPapers([])
    }
    setLoading(false)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(1)
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, journalFilter, ifRange, year, productFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function handleSearch() {
    setJournalFilter(searchInput)
  }

  function clearFilters() {
    setJournalFilter('')
    setSearchInput('')
    setIfRange('')
    setYear('')
    setProductFilter('')
  }

  const hasFilters = journalFilter || ifRange || year || productFilter

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative h-[300px] overflow-hidden border-b border-white/70 md:h-[380px]">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/brand/citation-hall-wall.jpg')" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-gray-50" />
      </section>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {/* Header */}
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">文献引用大厅</h1>
            <p className="text-sm text-gray-500">
              收录使用爱萌 ELISA 试剂盒发表的高质量 SCI 论文
            </p>
          </div>
          <Link
            href="/user/citations/submit"
            className="shrink-0 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
          >
            + 提交文献
          </Link>
          </div>
        </div>

        {/* Stats */}
        <CitationStats />

        {/* Filters */}
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-gray-700 mb-2">
            <Filter className="w-4 h-4" />
            <span className="font-medium">筛选条件</span>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-blue-600 hover:text-blue-700 ml-2"
              >
                清除全部
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Journal search */}
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="搜索期刊名称..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"
              >
                搜索
              </button>
            </div>

            {/* Product cat_no */}
            <input
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              placeholder="产品货号"
              className="w-32 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
            />

            {/* IF Range */}
            <select
              value={ifRange}
              onChange={(e) => setIfRange(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
            >
              {IF_RANGES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Year */}
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
            >
              {YEAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500">
          共 {total} 篇文献
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-40 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : papers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400">
            暂无符合条件的引用文献
          </div>
        ) : (
          <div className="space-y-4">
            {papers.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    {p.journal_cover_url ? (
                      <img
                        src={p.journal_cover_url}
                        alt={p.journal}
                        className="h-20 w-16 rounded-lg border object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-blue-50 to-slate-100 text-center text-[11px] font-semibold text-blue-700">
                        SCI
                        <br />
                        Paper
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 leading-snug">
                      {p.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">{getPaperAffiliation(p)}</p>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                      <span className="font-medium text-gray-700">
                        {p.journal}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-medium">
                        IF {p.impact_factor || '-'}
                      </span>
                      <span className="text-gray-400">
                        {p.publication_date
                          ? new Date(p.publication_date).getFullYear()
                          : '-'}
                      </span>
                      {p.doi ? (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          DOI
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : p.link ? (
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          原文链接
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : null}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {getPaperCatNos(p).map((catNo) => (
                        <span
                          key={catNo}
                          className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700"
                        >
                          {catNo}
                        </span>
                      ))}
                      {getPaperCatNos(p).length === 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">
                          货号审核中
                        </span>
                      )}
                    </div>

                    {p.products?.name && (
                      <Link
                        href={`/products/${p.products.slug}`}
                        className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-700 rounded-full text-xs font-medium hover:bg-slate-100"
                      >
                        {p.products.name}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              上一页
            </button>
            <span className="text-sm text-gray-500 px-3">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 flex items-center gap-1"
            >
              下一页
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
