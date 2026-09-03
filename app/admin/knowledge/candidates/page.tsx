'use client'

import { useCallback, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Clock,
  ChevronLeft,
  Trash2,
} from 'lucide-react'

interface Candidate {
  id: string
  source_conversation_id: string | null
  source_type: string
  question: string
  answer: string
  suggested_title: string
  content: string
  category: string
  tags: string[]
  ai_quality_score: number
  ai_extract_reason: string
  status: string
  created_at: string
}

export default function KnowledgeCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')
  const [error, setError] = useState('')

  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/knowledge/candidates?status=${filter}`)
      const data = await res.json().catch(() => ({})) as { candidates?: Candidate[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error || '知识候选加载失败')
      setCandidates(data.candidates || [])
    } catch (err: unknown) {
      setCandidates([])
      setError(err instanceof Error ? err.message : '知识候选加载失败')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始/切换筛选时需要同步触发一次后台数据请求。
    loadCandidates()
  }, [loadCandidates])

  async function handleAction(id: string, action: string, note?: string) {
    setActionLoading(id)
    setError('')
    try {
      const res = await fetch('/api/admin/knowledge/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note }),
      })
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== id))
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error || '操作失败')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">知识候选审核</h1>
          <p className="text-sm text-gray-500 mt-1">AI 从客服对话中自动提取的知识候选，审核后收录到 AI 客服知识库</p>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4" />
          返回概览
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 'pending', label: '待审核' },
          { value: 'approved', label: '已收录' },
          { value: 'rejected', label: '已拒绝' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50 border'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : candidates.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          {filter === 'pending' ? '暂无待审核的知识候选' : `暂无${filter === 'approved' ? '已收录' : '已拒绝'}的候选`}
        </div>
      ) : (
        <div className="space-y-4">
          {candidates.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-xl border p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <h3 className="font-semibold text-gray-900">{c.suggested_title}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.ai_quality_score >= 0.7
                          ? 'bg-green-50 text-green-700'
                          : c.ai_quality_score >= 0.5
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      AI 评分 {c.ai_quality_score}
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 mb-3 space-y-2">
                    <div>
                      <span className="font-medium text-gray-700">问题：</span>
                      {c.question}
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">解答：</span>
                      {c.answer.length > 200 ? c.answer.slice(0, 200) + '...' : c.answer}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    {c.category && (
                      <span className="px-2 py-0.5 bg-gray-100 rounded">{c.category}</span>
                    )}
                    {c.tags?.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-gray-100 rounded">
                        {tag}
                      </span>
                    ))}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(c.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>

                  {c.ai_extract_reason && (
                    <div className="mt-2 text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                      <span className="font-medium">AI 提取理由：</span>
                      {c.ai_extract_reason}
                    </div>
                  )}
                </div>

                {filter === 'pending' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(c.id, 'approve')}
                      disabled={actionLoading === c.id}
                      className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      收录到 AI 知识库
                    </button>
                    <button
                      onClick={() => handleAction(c.id, 'reject')}
                      disabled={actionLoading === c.id}
                      className="flex items-center gap-1 px-3 py-2 border text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      拒绝
                    </button>
                  </div>
                )}
                {filter !== 'pending' && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(c.id, 'delete')}
                      disabled={actionLoading === c.id}
                      className="flex items-center gap-1 px-3 py-2 border border-red-100 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      删除记录
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
