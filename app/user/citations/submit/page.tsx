'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CitationSubmitPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    product_cat_no: '',
    title: '',
    doi: '',
    journal: '',
    publication_year: '',
    authors: '',
    abstract: '',
  })

  useEffect(() => {
    fetch('/api/admin/products')
      .then(r => r.json())
      .then(data => {
        setProducts(data.products || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

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
      setSuccess(`提交成功！获得 ${data.pointsAwarded} 积分奖励`)
      setForm({ product_cat_no: '', title: '', doi: '', journal: '', publication_year: '', authors: '', abstract: '' })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/user/citations" className="text-blue-600 hover:underline text-sm">
            ← 我的文献
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">提交引用文献</h1>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">产品货号 *</label>
              {loading ? (
                <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ) : (
                <select
                  required
                  value={form.product_cat_no}
                  onChange={e => setForm({ ...form, product_cat_no: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
                >
                  <option value="">请选择产品</option>
                  {products.map(p => (
                    <option key={p.id} value={p.cat_no || p.slug}>
                      {p.cat_no || p.slug} - {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">论文标题 *</label>
              <input
                required
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
                placeholder="论文完整标题"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">DOI</label>
              <input
                value={form.doi}
                onChange={e => setForm({ ...form, doi: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
                placeholder="10.xxxx/xxxxx"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">期刊 *</label>
                <input
                  required
                  value={form.journal}
                  onChange={e => setForm({ ...form, journal: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
                  placeholder="期刊名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">发表年份</label>
                <input
                  value={form.publication_year}
                  onChange={e => setForm({ ...form, publication_year: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
                  placeholder="2024"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">作者</label>
              <input
                value={form.authors}
                onChange={e => setForm({ ...form, authors: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
                placeholder="作者1, 作者2, ..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">摘要</label>
              <textarea
                value={form.abstract}
                onChange={e => setForm({ ...form, abstract: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg outline-none focus:border-blue-500"
                placeholder="论文摘要（可选）"
              />
            </div>

            <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-1">积分奖励规则：</p>
              <ul className="space-y-1 text-blue-700">
                <li>投稿即得 50 积分</li>
                <li>审核通过额外奖励：IF &lt; 5 → 500分 | 5-10 → 800分 | 10-20 → 1200分 | ≥20 → 1500分</li>
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
