'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, Clock, Award, FlaskConical, ArrowLeft, Upload, Loader2 } from 'lucide-react'

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

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[]>([])
  const [loading, setLoading] = useState(true)
  const [points, setPoints] = useState(0)

  useEffect(() => {
    fetch('/api/papers?status=verified')
      .then((r) => r.json())
      .then((d) => setPapers(d.papers || []))
      .catch(() => setPapers([]))
      .finally(() => setLoading(false))

    fetch('/api/user/points')
      .then((r) => r.json())
      .then((d) => {
        if (d.balance !== undefined) setPoints(d.balance)
      })
      .catch(() => {})
  }, [])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">论文展示区</h1>
            <p className="text-xs text-gray-500">使用艾萌试剂盒发表的研究论文</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <Award className="w-4 h-4" />
            <span>{points} 积分</span>
          </div>
          <Link
            href="/upload"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Upload className="w-4 h-4" />
            上传论文
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : papers.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p>暂无审核通过的论文</p>
          <p className="text-sm mt-1">成为第一个上传论文并获取积分的用户吧</p>
        </div>
      ) : (
        <div className="space-y-4">
          {papers.map((p) => (
            <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-sm transition-shadow">
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
                    {p.doi && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        DOI: {p.doi}
                      </span>
                    )}
                    {p.products?.name && (
                      <span className="flex items-center gap-1">
                        <FlaskConical className="w-3 h-3" />
                        使用产品: {p.products.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(p.created_at).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {p.link ? (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      查看原文
                    </a>
                  ) : null}
                  {p.points_awarded > 0 && (
                    <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-lg">
                      <Award className="w-3 h-3" />
                      +{p.points_awarded} 积分
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
