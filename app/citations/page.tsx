'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import CitationStats from '@/components/citations/CitationStats'

interface Paper {
  id: string
  title: string
  authors: string
  journal: string
  doi: string
  impact_factor: number
  publication_date: string
  product_cat_no: string
  products: { name: string; target: string; slug: string } | null
}

const SORT_OPTIONS = [
  { value: 'newest', label: '最新发表' },
  { value: 'oldest', label: '最早发表' },
  { value: 'highest_if', label: '影响因子高→低' },
  { value: 'lowest_if', label: '影响因子低→高' },
]

export default function CitationsPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [sort, setSort] = useState('newest')
  const [journalFilter, setJournalFilter] = useState('')
  const [searchInput, setSearchInput] = useState('')

  async function load(currentPage = page) {
    setLoading(true)
    const params = new URLSearchParams()
    params.set('page', String(currentPage))
    params.set('limit', '20')
    params.set('sort', sort)
    if (journalFilter) params.set('journal', journalFilter)

    try {
      const res = await fetch(`/api/citations?${params.toString()}`)
      const data = await res.json()
      setPapers(data.papers || [])
      setTotalPages(data.totalPages || 1)
    } catch {
      setPapers([])
    }
    setLoading(false)
  }

  useEffect(() => {
    load(1)
    setPage(1)
  }, [sort, journalFilter])

  useEffect(() => {
    load(page)
  }, [page])

  function handleSearch() {
    setJournalFilter(searchInput)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
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
        <div className="bg-white border rounded-xl p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索期刊名称..."
              className="flex-1 px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900"
            >
              搜索
            </button>
            {journalFilter && (
              <button
                onClick={() => {
                  setJournalFilter('')
                  setSearchInput('')
                }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                清除
              </button>
            )}
          </div>
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

        {/* List */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-32 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : papers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400">
            暂无引用文献
          </div>
        ) : (
          <div className="space-y-4">
            {papers.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {p.title}
                    </h3>
                    <p className="text-sm text-gray-500 mb-2">{p.authors}</p>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                      <span className="font-medium text-gray-600">
                        {p.journal}
                      </span>
                      <span>IF: {p.impact_factor || '-'}</span>
                      <span>
                        {p.publication_date
                          ? new Date(p.publication_date).getFullYear()
                          : '-'}
                      </span>
                      {p.doi && (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          DOI: {p.doi}
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {p.products?.slug && (
                      <Link
                        href={`/products/${p.products.slug}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100"
                      >
                        {p.products.name || p.product_cat_no}
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
              className="px-3 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              上一页
            </button>
            <span className="text-sm text-gray-500">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
