'use client'

import { useState, useEffect } from 'react'

interface Paper {
  id: string
  title: string
  authors: string
  journal: string
  doi: string
  product_cat_no: string
  upload_status: string
  impact_factor: number
  points_awarded: number
  created_at: string
  rejection_reason: string
  profiles: { username: string; full_name: string } | null
}

export default function AdminCitationsPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [doiInput, setDoiInput] = useState('')
  const [doiResult, setDoiResult] = useState<any>(null)
  const [doiLoading, setDoiLoading] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [ifValue, setIfValue] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/citations?status=${filter}`)
    const data = await res.json()
    setPapers(data.papers || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filter])

  async function validateDoi() {
    if (!doiInput.trim()) return
    setDoiLoading(true)
    setDoiResult(null)
    try {
      const res = await fetch(`/api/citations/validate-doi?doi=${encodeURIComponent(doiInput)}`)
      const data = await res.json()
      if (res.ok) setDoiResult(data)
      else setMessage(data.error || '验证失败')
    } catch {
      setMessage('网络错误')
    }
    setDoiLoading(false)
  }

  async function handleApprove(id: string) {
    const ifVal = parseFloat(ifValue)
    if (!ifVal || ifVal <= 0) {
      setMessage('请输入有效的 Impact Factor')
      return
    }
    setActionId(id)
    try {
      const res = await fetch('/api/admin/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', paperId: id, impact_factor: ifVal }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(`审核通过，奖励 ${data.pointsAwarded} 积分`)
        setIfValue('')
        load()
      } else {
        setMessage(data.error)
      }
    } catch {
      setMessage('操作失败')
    }
    setActionId(null)
  }

  async function handleReject(id: string) {
    setActionId(id)
    try {
      const res = await fetch('/api/admin/citations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', paperId: id, rejection_reason: rejectReason }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage('已拒绝')
        setRejectReason('')
        load()
      } else {
        setMessage(data.error)
      }
    } catch {
      setMessage('操作失败')
    }
    setActionId(null)
  }

  const STATUS_MAP: Record<string, string> = {
    pending: '待审核',
    verified: '已通过',
    rejected: '已拒绝',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">文献审核</h1>
        <p className="text-sm text-gray-500">审核用户提交的引用文献，发放积分奖励</p>
      </div>

      {message && (
        <div className="p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">{message}</div>
      )}

      {/* DOI 验证工具 */}
      <div className="bg-white border rounded-xl p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-2">DOI 验证工具</h3>
        <div className="flex gap-2">
          <input
            value={doiInput}
            onChange={e => setDoiInput(e.target.value)}
            placeholder="输入 DOI 验证论文信息"
            className="flex-1 px-3 py-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
          />
          <button
            onClick={validateDoi}
            disabled={doiLoading}
            className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-900 disabled:opacity-50"
          >
            {doiLoading ? '验证中...' : '验证'}
          </button>
        </div>
        {doiResult && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm text-green-800 space-y-1">
            <p><strong>{doiResult.title}</strong></p>
            <p className="text-green-700">{doiResult.authors}</p>
            <p className="text-green-600">{doiResult.journal} · {doiResult.publication_year}</p>
          </div>
        )}
      </div>

      {/* 筛选 */}
      <div className="flex gap-2">
        {['all', 'pending', 'verified', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
              filter === s
                ? 'bg-blue-600 text-white'
                : 'bg-white border text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? '全部' : STATUS_MAP[s]}
          </button>
        ))}
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : papers.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400">
          暂无记录
        </div>
      ) : (
        <div className="space-y-3">
          {papers.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 mb-1">{p.title}</h3>
                  <p className="text-sm text-gray-500 mb-1">{p.authors}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span>期刊: {p.journal}</span>
                    <span>货号: {p.product_cat_no || '未填写'}</span>
                    <span>DOI: {p.doi || '无'}</span>
                    <span>投稿人: {p.profiles?.full_name || p.profiles?.username || '未知'}</span>
                    <span>{new Date(p.created_at).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                    p.upload_status === 'verified' ? 'bg-green-50 text-green-700' :
                    p.upload_status === 'rejected' ? 'bg-red-50 text-red-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {STATUS_MAP[p.upload_status]}
                  </span>
                  {p.upload_status === 'verified' && (
                    <span className="text-xs text-blue-600 font-medium">IF: {p.impact_factor} · +{p.points_awarded}分</span>
                  )}
                </div>
              </div>

              {p.upload_status === 'pending' && (
                <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3">
                  <input
                    type="number"
                    step="0.1"
                    value={ifValue}
                    onChange={e => setIfValue(e.target.value)}
                    placeholder="输入 Impact Factor"
                    className="w-36 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleApprove(p.id)}
                    disabled={actionId === p.id}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50"
                  >
                    {actionId === p.id ? '处理中...' : '通过'}
                  </button>
                  <input
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="拒绝原因（可选）"
                    className="flex-1 min-w-[120px] px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={() => handleReject(p.id)}
                    disabled={actionId === p.id}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    拒绝
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
