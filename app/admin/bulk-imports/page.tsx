'use client'

import { useState, useEffect } from 'react'
import { History, RotateCcw, Package, MapPin, Loader2, CheckCircle, XCircle } from 'lucide-react'

interface Batch {
  id: string
  type: 'products' | 'agents'
  created_at: string
  product_count: number
  image_count: number
  status: 'completed' | 'rolled_back'
  user_id: string
  details: {
    success?: number
    failed?: number
    skippedImages?: number
    created_ids?: string[]
    rollback_at?: string
    rollback_result?: { deleted: number; failed: number }
  }
}

export default function BulkImportsPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'agents'>('products')
  const [rollingBackId, setRollingBackId] = useState<string | null>(null)

  const fetchBatches = () => {
    setLoading(true)
    fetch(`/api/admin/bulk-import-batches?type=${activeTab}`)
      .then((r) => r.json())
      .then((d) => setBatches(d.batches || []))
      .catch(() => setBatches([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchBatches()
  }, [activeTab])

  const handleRollback = async (batch: Batch) => {
    if (!confirm(`确定回滚该批次？\n类型：${batch.type === 'products' ? '商品' : '代理商'}\n数量：${batch.product_count}\n\n回滚将删除该批次导入的所有记录。`)) {
      return
    }
    setRollingBackId(batch.id)
    try {
      const res = await fetch(`/api/admin/bulk-import-batches?id=${batch.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        alert(`回滚完成：删除 ${data.deleted} 条，失败 ${data.failed} 条`)
      } else {
        alert(data.error || '回滚失败')
      }
    } catch {
      alert('回滚请求失败')
    }
    setRollingBackId(null)
    fetchBatches()
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-cyan-400" /> 批量导入记录
        </h1>
        <p className="text-sm text-slate-400 mt-1">查看和管理商品、代理商的批量导入批次，支持回滚操作</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'products'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <Package className="w-4 h-4" /> 商品导入
        </button>
        <button
          onClick={() => setActiveTab('agents')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'agents'
              ? 'bg-cyan-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <MapPin className="w-4 h-4" /> 代理商导入
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
          <div className="col-span-2">时间</div>
          <div className="col-span-2">批次 ID</div>
          <div className="col-span-1">数量</div>
          <div className="col-span-1">图片</div>
          <div className="col-span-2">导入结果</div>
          <div className="col-span-1">状态</div>
          <div className="col-span-3 text-right">操作</div>
        </div>

        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">加载中...</div>
        ) : batches.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">暂无导入记录</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {batches.map((batch) => (
              <div key={batch.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-2 text-xs text-gray-600">{formatDate(batch.created_at)}</div>
                <div className="col-span-2 text-xs text-gray-500 font-mono truncate" title={batch.id}>
                  {batch.id.slice(0, 8)}...
                </div>
                <div className="col-span-1 text-sm text-gray-700">{batch.product_count}</div>
                <div className="col-span-1 text-sm text-gray-700">{batch.image_count}</div>
                <div className="col-span-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600">{batch.details?.success ?? 0} 成功</span>
                    <span className="text-red-500">{batch.details?.failed ?? 0} 失败</span>
                  </div>
                  {batch.details?.skippedImages ? (
                    <div className="text-amber-600 mt-0.5">{batch.details.skippedImages} 图片跳过</div>
                  ) : null}
                </div>
                <div className="col-span-1">
                  {batch.status === 'completed' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                      <CheckCircle className="w-3 h-3" /> 已完成
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                      <XCircle className="w-3 h-3" /> 已回滚
                    </span>
                  )}
                </div>
                <div className="col-span-3 flex items-center justify-end gap-2">
                  {batch.status === 'completed' && (
                    <button
                      onClick={() => handleRollback(batch)}
                      disabled={rollingBackId === batch.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      {rollingBackId === batch.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RotateCcw className="w-3 h-3" />
                      )}
                      回滚
                    </button>
                  )}
                  {batch.status === 'rolled_back' && batch.details?.rollback_result && (
                    <span className="text-[10px] text-gray-400">
                      已删 {batch.details.rollback_result.deleted} / 失败 {batch.details.rollback_result.failed}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
