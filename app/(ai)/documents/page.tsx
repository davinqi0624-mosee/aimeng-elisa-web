'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Search,
  Trash2,
  FileText,
  Tag,
  Calendar,
  AlertCircle,
  Plus,
  Loader2,
} from 'lucide-react'

interface Document {
  id: string
  title: string
  content: string
  category: string
  tags: string[]
  source: string
  created_at: string
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const [seedLoading, setSeedLoading] = useState(false)

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (category) params.set('category', category)
      const res = await fetch(`/api/ai/documents?${params.toString()}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDocs(data.documents)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [q, category])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该文档？')) return
    try {
      const res = await fetch('/api/ai/documents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setDocs((prev) => prev.filter((d) => d.id !== id))
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleSeed = async () => {
    setSeedLoading(true)
    try {
      const res = await fetch('/api/ai/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: false }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      fetchDocs()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSeedLoading(false)
    }
  }

  const categories = Array.from(new Set(docs.map((d) => d.category).filter(Boolean)))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">知识库管理</h1>
          <p className="text-sm text-gray-500 mt-1">管理 ELISA 知识库文档，支持向量检索</p>
        </div>
        <button
          onClick={handleSeed}
          disabled={seedLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {seedLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          初始化示例数据
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索文档标题..."
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">所有分类</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>暂无文档，请点击「初始化示例数据」</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">标题</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">分类</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">标签</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">来源</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">创建时间</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{doc.title}</div>
                    <div className="text-gray-500 truncate max-w-xs">{doc.content.slice(0, 60)}...</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                      {doc.category || '未分类'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {(doc.tags || []).slice(0, 3).map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                          <Tag className="w-3 h-3" />
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{doc.source}</td>
                  <td className="px-4 py-3 text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(doc.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
