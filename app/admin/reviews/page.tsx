'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Loader2,
  CheckSquare,
  Square,
  Award,
  FileText,
  User,
  Package,
  ExternalLink,
} from 'lucide-react'

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
  products?: { name: string } | null
}

const STATUS_MAP: Record<string, string> = {
  pending: '待审核',
  verified: '已通过',
  rejected: '已拒绝',
}

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待审核' },
  { key: 'verified', label: '已通过' },
  { key: 'rejected', label: '已拒绝' },
]

export default function AdminReviewsPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [actionId, setActionId] = useState<string | null>(null)

  // Modals
  const [batchApproveOpen, setBatchApproveOpen] = useState(false)
  const [batchRejectOpen, setBatchRejectOpen] = useState(false)
  const [batchIf, setBatchIf] = useState('')
  const [batchReason, setBatchReason] = useState('')

  // Per-row inputs
  const [rowIf, setRowIf] = useState<Record<string, string>>({})
  const [rowReason, setRowReason] = useState<Record<string, string>>({})

  async function load() {
    setLoading(true)
    const res = await fetch(`/api/admin/citations?status=${filter}`)
    const data = await res.json()
    setPapers(data.papers || [])
    setSelected(new Set())
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [filter])

  const filteredPapers = useMemo(() => {
    if (!search.trim()) return papers
    const q = search.toLowerCase()
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.journal.toLowerCase().includes(q)
    )
  }, [papers, search])

  const counts = useMemo(() => {
    const c = { all: papers.length, pending: 0, verified: 0, rejected: 0 }
    papers.forEach((p) => {
      if (p.upload_status in c) c[p.upload_status as keyof typeof c]++
    })
    return c
  }, [papers])

  const pendingSelected = useMemo(
    () => filteredPapers.filter((p) => selected.has(p.id) && p.upload_status === 'pending'),
    [filteredPapers, selected]
  )

  function toggleSelect(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function toggleSelectAll() {
    const visiblePending = filteredPapers.filter((p) => p.upload_status === 'pending')
    if (visiblePending.every((p) => selected.has(p.id))) {
      const next = new Set(selected)
      visiblePending.forEach((p) => next.delete(p.id))
      setSelected(next)
    } else {
      const next = new Set(selected)
      visiblePending.forEach((p) => next.add(p.id))
      setSelected(next)
    }
  }

  async function apiAction(body: object) {
    const res = await fetch('/api/admin/citations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async function handleApprove(id: string, ifVal: number) {
    if (!ifVal || ifVal <= 0) {
      setMessage('请输入有效的 Impact Factor')
      return
    }
    setActionId(id)
    const data = await apiAction({ action: 'approve', paperId: id, impact_factor: ifVal })
    if (data.pointsAwarded !== undefined) {
      setMessage(`审核通过，奖励 ${data.pointsAwarded} 积分`)
      setRowIf((prev) => ({ ...prev, [id]: '' }))
      load()
    } else {
      setMessage(data.error || '操作失败')
    }
    setActionId(null)
  }

  async function handleReject(id: string, reason: string) {
    setActionId(id)
    const data = await apiAction({ action: 'reject', paperId: id, rejection_reason: reason })
    if (data.error) setMessage(data.error)
    else {
      setMessage('已拒绝')
      setRowReason((prev) => ({ ...prev, [id]: '' }))
      load()
    }
    setActionId(null)
  }

  async function batchApprove() {
    const ifVal = parseFloat(batchIf)
    if (!ifVal || ifVal <= 0) {
      setMessage('请输入有效的 Impact Factor')
      return
    }
    setActionId('batch')
    let ok = 0
    for (const p of pendingSelected) {
      const data = await apiAction({ action: 'approve', paperId: p.id, impact_factor: ifVal })
      if (data.pointsAwarded !== undefined) ok++
    }
    setMessage(`批量通过 ${ok} 篇文献`)
    setBatchIf('')
    setBatchApproveOpen(false)
    setSelected(new Set())
    load()
    setActionId(null)
  }

  async function batchReject() {
    setActionId('batch')
    let ok = 0
    for (const p of pendingSelected) {
      const data = await apiAction({ action: 'reject', paperId: p.id, rejection_reason: batchReason })
      if (!data.error) ok++
    }
    setMessage(`批量拒绝 ${ok} 篇文献`)
    setBatchReason('')
    setBatchRejectOpen(false)
    setSelected(new Set())
    load()
    setActionId(null)
  }

  const Badge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
    }
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock size={12} />,
      verified: <CheckCircle2 size={12} />,
      rejected: <XCircle size={12} />,
    }
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
        {icons[status]}
        {STATUS_MAP[status] || status}
      </span>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white">文献审核</h1>
        <p className="text-sm text-slate-400 mt-1">审核用户提交的引用文献，发放积分奖励</p>
      </div>

      {message && (
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-200">
          <FileText size={14} className="text-blue-400 shrink-0" />
          {message}
          <button onClick={() => setMessage('')} className="ml-auto text-slate-500 hover:text-slate-300">
            <XCircle size={14} />
          </button>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === t.key
                  ? 'bg-white text-slate-900'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t.label}
              <span className={`ml-1.5 text-xs ${filter === t.key ? 'text-slate-500' : 'text-slate-600'}`}>
                {counts[t.key as keyof typeof counts]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索标题、作者、期刊..."
            className="pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 outline-none focus:border-slate-500 w-64"
          />
        </div>
      </div>

      {/* Batch actions */}
      {pendingSelected.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-lg">
          <span className="text-sm text-slate-400">已选 {pendingSelected.length} 篇</span>
          <div className="flex-1" />
          <button
            onClick={() => setBatchApproveOpen(true)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-sm font-medium transition-colors"
          >
            一键通过
          </button>
          <button
            onClick={() => setBatchRejectOpen(true)}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-md text-sm font-medium transition-colors"
          >
            一键拒绝
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-4 py-3 w-10">
                <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700">
                  {filteredPapers.filter((p) => p.upload_status === 'pending').every((p) => selected.has(p.id)) ? (
                    <CheckSquare size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">文献信息</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">产品</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">投稿人</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">状态</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-4 py-4"><div className="h-4 w-4 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-3/4 bg-slate-100 rounded animate-pulse mb-2" />
                    <div className="h-3 w-1/2 bg-slate-100 rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-4"><div className="h-3 w-20 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-3 w-16 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-5 w-16 bg-slate-100 rounded animate-pulse" /></td>
                  <td className="px-4 py-4"><div className="h-8 w-24 bg-slate-100 rounded animate-pulse" /></td>
                </tr>
              ))
            ) : filteredPapers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center text-slate-400">
                  暂无记录
                </td>
              </tr>
            ) : (
              filteredPapers.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-4 py-3">
                    {p.upload_status === 'pending' && (
                      <button onClick={() => toggleSelect(p.id)} className="text-slate-400 hover:text-slate-700">
                        {selected.has(p.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 line-clamp-2 max-w-md">{p.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{p.authors}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                      <span>{p.journal}</span>
                      {p.doi && (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-blue-600 hover:underline"
                        >
                          DOI <ExternalLink size={10} />
                        </a>
                      )}
                      <span>{new Date(p.created_at).toLocaleDateString('zh-CN')}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <Package size={13} className="text-slate-400" />
                      <span className="text-xs">{p.products?.name || p.product_cat_no || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-700">
                      <User size={13} className="text-slate-400" />
                      <span className="text-xs">{p.profiles?.full_name || p.profiles?.username || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={p.upload_status} />
                    {p.upload_status === 'verified' && (
                      <div className="flex items-center gap-1 mt-1.5 text-xs text-emerald-600 font-medium">
                        <Award size={12} />
                        IF {p.impact_factor} · +{p.points_awarded} 分
                      </div>
                    )}
                    {p.upload_status === 'rejected' && p.rejection_reason && (
                      <div className="mt-1.5 text-xs text-red-500 max-w-[180px] truncate" title={p.rejection_reason}>
                        {p.rejection_reason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {p.upload_status === 'pending' ? (
                      <div className="flex flex-col gap-1.5 min-w-[140px]">
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            step="0.1"
                            value={rowIf[p.id] || ''}
                            onChange={(e) => setRowIf((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="IF"
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleApprove(p.id, parseFloat(rowIf[p.id] || ''))}
                            disabled={actionId === p.id}
                            className="px-2 py-1 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {actionId === p.id ? <Loader2 size={12} className="animate-spin" /> : '通过'}
                          </button>
                        </div>
                        <div className="flex gap-1.5">
                          <input
                            value={rowReason[p.id] || ''}
                            onChange={(e) => setRowReason((prev) => ({ ...prev, [p.id]: e.target.value }))}
                            placeholder="拒绝原因"
                            className="flex-1 min-w-0 px-2 py-1 border border-slate-200 rounded text-xs outline-none focus:border-blue-500"
                          />
                          <button
                            onClick={() => handleReject(p.id, rowReason[p.id] || '')}
                            disabled={actionId === p.id}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 disabled:opacity-50"
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Batch Approve Modal */}
      {batchApproveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-white font-semibold mb-1">一键通过</h3>
            <p className="text-sm text-slate-400 mb-4">将为 {pendingSelected.length} 篇待审核文献设置相同的 Impact Factor 并审核通过。</p>
            <label className="block text-sm text-slate-300 mb-1.5">Impact Factor</label>
            <input
              type="number"
              step="0.1"
              value={batchIf}
              onChange={(e) => setBatchIf(e.target.value)}
              placeholder="例如: 5.2"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-blue-500 mb-5"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setBatchApproveOpen(false); setBatchIf('') }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={batchApprove}
                disabled={actionId === 'batch'}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {actionId === 'batch' ? <Loader2 size={14} className="animate-spin" /> : '确认通过'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Reject Modal */}
      {batchRejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-white font-semibold mb-1">一键拒绝</h3>
            <p className="text-sm text-slate-400 mb-4">将拒绝 {pendingSelected.length} 篇待审核文献。</p>
            <label className="block text-sm text-slate-300 mb-1.5">拒绝原因</label>
            <input
              value={batchReason}
              onChange={(e) => setBatchReason(e.target.value)}
              placeholder="请输入拒绝原因"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm outline-none focus:border-blue-500 mb-5"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setBatchRejectOpen(false); setBatchReason('') }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={batchReject}
                disabled={actionId === 'batch'}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {actionId === 'batch' ? <Loader2 size={14} className="animate-spin" /> : '确认拒绝'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
