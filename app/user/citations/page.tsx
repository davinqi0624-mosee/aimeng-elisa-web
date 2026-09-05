'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Paper {
  id: string
  title: string
  journal: string
  doi: string
  upload_status: string
  points_awarded: number
  impact_factor: number
  created_at: string
  rejection_reason: string
  products: { name: string; target: string } | null
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: '待审核', color: 'bg-amber-50 text-amber-700' },
  verified: { label: '已通过', color: 'bg-green-50 text-green-700' },
  rejected: { label: '已拒绝', color: 'bg-red-50 text-red-700' },
}

export default function MyCitationsPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    fetch('/api/user/citations')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setLoadError(data.error)
          setPapers([])
          return
        }
        setPapers(data.papers || [])
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : '文献投稿记录加载失败')
        setPapers([])
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-[#F2F6FA] py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black tracking-normal text-slate-950">我的文献投稿</h1>
          <Link
            href="/user/citations/submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            + 提交新文献
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
            文献投稿记录加载失败：{loadError}
          </div>
        ) : papers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center">
            <p className="text-gray-400 mb-4">暂无投稿记录</p>
            <Link
              href="/user/citations/submit"
              className="text-blue-600 hover:underline text-sm"
            >
              去提交第一篇文献 →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {papers.map(p => {
              const st = STATUS_MAP[p.upload_status] || STATUS_MAP.pending
              return (
                <div key={p.id} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 mb-1">{p.title}</h3>
                      <p className="text-sm text-gray-500 mb-2">
                        {p.journal} {p.doi && `· DOI: ${p.doi}`}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>产品: {p.products?.name || '未知'}</span>
                        <span>{new Date(p.created_at).toLocaleDateString('zh-CN')} 提交</span>
                      </div>
                      {p.rejection_reason && (
                        <p className="mt-2 text-xs text-red-600">
                          拒绝原因: {p.rejection_reason}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${st.color}`}>
                        {st.label}
                      </span>
                      {p.upload_status === 'verified' && (
                        <span className="text-sm font-bold text-blue-600">
                          +{p.points_awarded} 积分
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
