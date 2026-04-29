'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import CitationStats from '@/components/citations/CitationStats'
import { ExternalLink, Filter, Search, ChevronLeft, ChevronRight } from 'lucide-react'

interface Paper {
  id: string
  title: string
  authors: string
  journal: string
  doi: string
  impact_factor: number
  publication_date: string
  product_cat_no: string
  products: { name: string; target: string; slug: string; cat_no: string } | null
}

const SORT_OPTIONS = [
  { value: 'newest', label: '最新发表' },
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
    load(1)
    setPage(1)
  }, [sort, journalFilter, ifRange, year, productFilter])

  useEffect(() => {
    load(page)
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
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">文献引用大厅</h1>
          <p className="text-sm text-gray-500">
            收录使用爱萌 ELISA 试剂盒发表的高质量 SCI 论文
          </p>
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
                  {/* Product badge */}
                  <div className="shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                    {p.products?.slug ? (
                      <Link
                        href={`/products/${p.products.slug}`}
                        className="text-center"
                      >
                        <span className="text-xs text-gray-500 block">货号</span>
                        <span className="text-sm font-semibold text-blue-700">
                          {p.product_cat_no || p.products.cat_no || '—'}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400 text-center">
                        {p.product_cat_no || '—'}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1 leading-snug">
                      {p.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">{p.authors}</p>

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
                      {p.doi && (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline inline-flex items-center gap-1"
                        >
                          DOI
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {p.products?.name && (
                      <div className="mt-2">
                        <Link
                          href={`/products/${p.products.slug}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100"
                        >
                          {p.products.name}
                        </Link>
                      </div>
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
      </div>
    </div>
  )
}
