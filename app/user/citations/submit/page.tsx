'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'

interface MatchedProduct {
  id: string
  cat_no: string
  name: string
  species: string
  target: string
}

export default function CitationSubmitPage() {
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [showOptional, setShowOptional] = useState(false)

  const [productQuery, setProductQuery] = useState('')
  const [matchedProducts, setMatchedProducts] = useState<MatchedProduct[]>([])
  const [showMatches, setShowMatches] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<MatchedProduct | null>(null)
  const [loadingMatches, setLoadingMatches] = useState(false)

  const [form, setForm] = useState({
    product_cat_no: '',
    title: '',
    journal: '',
    publication_year: '',
    abstract: '',
  })

  const matchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (matchRef.current && !matchRef.current.contains(e.target as Node)) {
        setShowMatches(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchMatches = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setMatchedProducts([])
      setShowMatches(false)
      return
    }
    setLoadingMatches(true)
    try {
      const res = await fetch(`/api/products/match?query=${encodeURIComponent(query)}`)
      const data = await res.json()
      setMatchedProducts(data.products || [])
      setShowMatches((data.products || []).length > 0)
    } catch {
      setMatchedProducts([])
    } finally {
      setLoadingMatches(false)
    }
  }, [])

  function handleProductInputChange(value: string) {
    setProductQuery(value)
    setSelectedProduct(null)
    setForm((prev) => ({ ...prev, product_cat_no: value }))

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchMatches(value)
    }, 250)
  }

  function handleSelectProduct(product: MatchedProduct) {
    setSelectedProduct(product)
    setProductQuery(`${product.cat_no} - ${product.name}`)
    setForm((prev) => ({ ...prev, product_cat_no: product.cat_no }))
    setShowMatches(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/citations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess('提交成功！您已获得50积分投稿奖励。审核通过后将追加发放积分。')
      setForm({ product_cat_no: '', title: '', journal: '', publication_year: '', abstract: '' })
      setProductQuery('')
      setSelectedProduct(null)
      setShowOptional(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/user/citations" className="text-blue-600 hover:underline text-sm">
            ← 我的文献
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">提交引用文献</h1>
          <p className="text-sm text-gray-500 mb-6">
            提交使用爱萌产品的 SCI 论文，审核通过后可获得高额积分奖励
          </p>

          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Product - Smart Input */}
            <div ref={matchRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                产品货号 <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={productQuery}
                onChange={(e) => handleProductInputChange(e.target.value)}
                onFocus={() => {
                  if (matchedProducts.length > 0) setShowMatches(true)
                }}
                placeholder="输入货号（如 LV30683）或 种属+指标（如 Human IL-6）"
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
              />
              {loadingMatches && (
                <div className="absolute right-3 top-[2.1rem]">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Match dropdown */}
              {showMatches && (
                <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg overflow-hidden">
                  {matchedProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors border-b last:border-b-0 border-gray-100"
                    >
                      <span className="shrink-0 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono font-medium">
                        {p.cat_no}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm text-gray-900 truncate">{p.name}</div>
                        <div className="text-xs text-gray-400">
                          {p.species} · {p.target}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {selectedProduct && (
                <div className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  已选择: {selectedProduct.cat_no}
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                论文题目 <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                placeholder="论文完整标题"
              />
            </div>

            {/* Journal */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                期刊名称 <span className="text-red-500">*</span>
              </label>
              <input
                required
                value={form.journal}
                onChange={(e) => setForm({ ...form, journal: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                placeholder="期刊名称"
              />
            </div>

            {/* Optional fields toggle */}
            <button
              type="button"
              onClick={() => setShowOptional(!showOptional)}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              {showOptional ? '收起可选项' : '+ 添加更多信息（摘要、发表年份）'}
            </button>

            {showOptional && (
              <div className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">发表年份</label>
                    <input
                      value={form.publication_year}
                      onChange={(e) => setForm({ ...form, publication_year: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                      placeholder="2024"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">论文摘要</label>
                  <textarea
                    value={form.abstract}
                    onChange={(e) => setForm({ ...form, abstract: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                    placeholder="论文摘要（可选）"
                  />
                </div>
              </div>
            )}

            {/* Points rules */}
            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">积分奖励规则（总计）：</p>
              <ul className="space-y-1 text-blue-700">
                <li>投稿即得 50 积分</li>
                <li>
                  审核通过追加：IF &lt; 5 → 450分（合计500）| 5-10 → 750分（合计800）| 10-20 →
                  1150分（合计1200）| ≥20 → 1450分（合计1500）
                </li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {submitting ? '提交中...' : '提交文献'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
