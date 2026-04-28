'use client'

import { useState, useEffect } from 'react'
import { FileText, CheckCircle2, XCircle, Loader2 } from 'lucide-react'

interface Paper {
  id: string
  title: string
  authors: string
  journal: string
  doi: string | null
  link: string | null
  abstract: string | null
  status: string
  points_awarded: number
  created_at: string
  products: { name: string; target: string } | null
}

export default function AdminPapersPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const fetchPapers = () => {
    setLoading(true)
    fetch('/api/papers?status=pending')
      .then((r) => r.json())
      .then((d) => setPapers(d.papers || []))
      .catch(() => setPapers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchPapers()
  }, [])

  const handleVerify = async (id: string, action: 'verify' | 'reject') => {
    if (action === 'reject' && !confirm('确定拒绝这篇论文吗？')) return
    setProcessingId(id)
    try {
      const res = await fetch('/api/papers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId: id, action, note }),
      })
      if (res.ok) {
        setNote('')
        fetchPapers()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-600" />
          积分审核（论文）
        </h1>
        <p className="text-sm text-gray-500">审核用户上传的论文，通过后可发放积分奖励</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-3">
        <label className="block text-xs text-gray-500 mb-1">审核备注（可选）</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="填写审核备注，将随积分一起记录"
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : papers.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">暂无待审核论文</div>
      ) : (
        <div className="space-y-4">
          {papers.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-gray-900 mb-1">{p.title}</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">{p.authors}</span> · {p.journal}
                  </p>
                  {p.abstract && (
                    <p className="text-sm text-gray-500 line-clamp-2 mb-3">{p.abstract}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {p.doi && <span>DOI: {p.doi}</span>}
                    {p.products?.name && <span>使用产品: {p.products.name}</span>}
                    <span>{new Date(p.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  <button
                    onClick={() => handleVerify(p.id, 'verify')}
                    disabled={processingId === p.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    通过
                  </button>
                  <button
                    onClick={() => handleVerify(p.id, 'reject')}
                    disabled={processingId === p.id}
                    className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    拒绝
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
