'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  FileText,
  Plus,
  Loader2,
  Trash2,
  ArrowLeft,
  Clock,
  FlaskConical,
  Tag,
} from 'lucide-react'

interface Datasheet {
  id: string
  title: string
  target: string
  species: string
  method: string
  status: string
  catalog_number: string | null
  size: string | null
  created_at: string
}

export default function DatasheetListPage() {
  const router = useRouter()
  const [datasheets, setDatasheets] = useState<Datasheet[]>([])
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string>('user')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/datasheet')
      .then((r) => r.json())
      .then((d) => setDatasheets(d.datasheets || []))
      .catch(() => setDatasheets([]))
      .finally(() => setLoading(false))

    fetch('/api/user/points')
      .then((r) => r.json())
      .then((d) => setRole(d.role || 'user'))
      .catch(() => setRole('user'))
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这份说明书吗？')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/datasheet?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setDatasheets((prev) => prev.filter((ds) => ds.id !== id))
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
    }
  }

  const methodLabel = (m: string) => {
    if (m === 'sandwich') return '夹心法'
    if (m === 'competitive') return '竞争法'
    if (m === 'chemiluminescence') return '化学发光法'
    return m
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">智能说明书</h1>
            <p className="text-xs text-gray-500">AI 生成的 ELISA 试剂盒说明书</p>
          </div>
        </div>
        {(role === 'super' || role === 'level1' || role === 'level2') && (
          <Link
            href="/datasheet/generate"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            生成说明书
          </Link>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : datasheets.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-xl">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 mb-4">暂无生成的说明书</p>
          {(role === 'admin_l1' || role === 'admin_l2') && (
            <Link
              href="/datasheet/generate"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              生成第一份说明书
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
            <div className="col-span-3">货号 / 标题</div>
            <div className="col-span-2">方法</div>
            <div className="col-span-2">规格</div>
            <div className="col-span-2">状态</div>
            <div className="col-span-2">创建时间</div>
            <div className="col-span-1 text-right">操作</div>
          </div>
          <div className="divide-y divide-gray-100">
            {datasheets.map((ds) => (
              <div
                key={ds.id}
                className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => router.push(`/datasheet/${ds.id}`)}
              >
                <div className="col-span-3">
                  <div className="flex items-center gap-1.5">
                    {ds.catalog_number && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium shrink-0">
                        <Tag className="w-3 h-3" />
                        {ds.catalog_number}
                      </span>
                    )}
                    <span className="text-sm font-medium text-gray-900 truncate">{ds.target}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{ds.title}</p>
                </div>
                <div className="col-span-2 flex items-center gap-1">
                  <FlaskConical className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-xs text-gray-600">{methodLabel(ds.method)}</span>
                </div>
                <div className="col-span-2 text-xs text-gray-600">{ds.size || '-'}</div>
                <div className="col-span-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      ds.status === 'published'
                        ? 'bg-emerald-50 text-emerald-700'
                        : ds.status === 'draft'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    {ds.status === 'published' ? '已发布' : ds.status === 'draft' ? '草稿' : '已归档'}
                  </span>
                </div>
                <div className="col-span-2 flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {new Date(ds.created_at).toLocaleDateString('zh-CN')}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(ds.id)
                    }}
                    disabled={deletingId === ds.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    {deletingId === ds.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
