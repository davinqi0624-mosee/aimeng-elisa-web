'use client'

import { useState } from 'react'
import { Download, FileSearch, Loader2, Search } from 'lucide-react'

type CoaDocument = {
  id: string
  catalog_number: string
  batch_number: string
  product_name?: string | null
  file_url: string
  file_name?: string | null
  created_at?: string | null
}

export default function CoaLookupForm({ initialCatalog = '' }: { initialCatalog?: string }) {
  const [catalogNumber, setCatalogNumber] = useState(initialCatalog)
  const [batchNumber, setBatchNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [document, setDocument] = useState<CoaDocument | null>(null)
  const [searched, setSearched] = useState(false)

  async function handleSearch(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setDocument(null)
    setSearched(false)

    if (!catalogNumber.trim() || !batchNumber.trim()) {
      setError('请同时输入血清货号和批号。')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        catalog_number: catalogNumber.trim(),
        batch_number: batchNumber.trim(),
      })
      const res = await fetch(`/api/products/coa?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'COA 查询失败，请稍后重试。')
        return
      }
      setDocument(data.document || null)
      setSearched(true)
    } catch {
      setError('COA 查询失败，请检查网络后重试。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <FileSearch className="h-4 w-4 text-teal-700" />
        查询条件
      </div>

      <form onSubmit={handleSearch} className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">血清货号</span>
          <input
            type="text"
            value={catalogNumber}
            onChange={(event) => setCatalogNumber(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            placeholder="例如 AM-FBS-STD-500"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">批号</span>
          <input
            type="text"
            value={batchNumber}
            onChange={(event) => setBatchNumber(event.target.value)}
            className="h-11 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            placeholder="请输入瓶身或标签上的批号"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {loading ? '查询中...' : '查询 COA'}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-800">
          {error}
        </div>
      )}

      {searched && !document && !error && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-600">
          未找到对应 COA。请确认货号和批号是否输入完整，或联系技术支持补发文件。
        </div>
      )}

      {document && (
        <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-sm font-bold text-teal-900">已找到 COA 文件</p>
          <div className="mt-2 space-y-1 text-sm text-teal-800">
            <p>货号：{document.catalog_number}</p>
            <p>批号：{document.batch_number}</p>
            {document.product_name && <p>产品：{document.product_name}</p>}
          </div>
          <a
            href={document.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-700"
          >
            <Download className="h-4 w-4" />
            下载 COA
          </a>
        </div>
      )}
    </div>
  )
}
