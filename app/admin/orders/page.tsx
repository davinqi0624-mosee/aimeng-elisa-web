'use client'

import { useState, useEffect } from 'react'
import { ClipboardList, Loader2 } from 'lucide-react'

interface Order {
  id: string
  user_id: string
  item_id: string
  points_spent: number
  status: string
  remark: string | null
  contact_name: string | null
  contact_phone: string | null
  contact_email: string | null
  user_email: string | null
  shipping_address: string | null
  shipping_note: string | null
  reviewed_at: string | null
  shipped_at: string | null
  created_at: string
  shop_items: { name: string } | null
  profiles: { full_name: string } | null
}

const STATUS_MAP: Record<string, string> = {
  pending: '待审核',
  approved: '已审核待发货',
  fulfilled: '已完成/已发货',
  cancelled: '已取消',
}

const STATUS_CLASS_MAP: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  fulfilled: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-gray-50 text-gray-600',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchOrders = () => {
    setLoading(true)
    setError('')
    fetch('/api/admin/orders')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setOrders([])
          setError(d.error)
        } else {
          setOrders(d.orders || [])
        }
      })
      .catch((err) => {
        setOrders([])
        setError(err.message || '订单加载失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    fetchOrders()
  }, [])

  const updateStatus = async (id: string, status: string) => {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        fetchOrders()
      } else {
        setError(data.error || '订单状态更新失败')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '订单状态更新失败')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-300" />
          兑换订单管理
        </h1>
        <p className="text-sm text-slate-300">查看并处理用户的积分兑换订单</p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-slate-300 text-sm">暂无兑换订单</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
            <div className="col-span-3">奖品</div>
            <div className="col-span-2">用户</div>
            <div className="col-span-4">收货信息</div>
            <div className="col-span-1">积分</div>
            <div className="col-span-2 text-right">操作</div>
          </div>
          <div className="divide-y divide-gray-100">
            {orders.map((o) => (
              <div key={o.id} className="grid grid-cols-12 gap-2 px-4 py-4 items-start hover:bg-gray-50 transition-colors">
                <div className="col-span-3">
                  <div className="text-sm font-medium text-gray-900">{o.shop_items?.name || '未知奖品'}</div>
                  <div className="mt-1 text-xs text-gray-400">{new Date(o.created_at).toLocaleString('zh-CN')}</div>
                  <span className={`mt-2 inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_CLASS_MAP[o.status] || 'bg-gray-50 text-gray-600'}`}>
                    {STATUS_MAP[o.status] || o.status}
                  </span>
                </div>
                <div className="col-span-2 text-xs text-gray-600">
                  <div className="truncate">{o.profiles?.full_name || o.user_id.slice(0, 8)}</div>
                  <div className="mt-1 truncate text-gray-500">{o.user_email || '未获取邮箱'}</div>
                  <div className="mt-1 text-gray-400 truncate">{o.user_id}</div>
                </div>
                <div className="col-span-4 text-xs leading-5 text-gray-600">
                  <div className="font-medium text-gray-900">{o.contact_name || '未填写'} · {o.contact_phone || '未填写电话'}</div>
                  <div>{o.contact_email || '未填写邮箱'}</div>
                  <div className="mt-1 whitespace-pre-wrap text-gray-700">{o.shipping_address || '未填写收货地址'}</div>
                  {o.shipping_note && <div className="mt-1 text-amber-700">备注：{o.shipping_note}</div>}
                  {o.remark && <div className="mt-1 text-slate-500">后台备注：{o.remark}</div>}
                </div>
                <div className="col-span-1 text-sm text-amber-600 font-semibold">{o.points_spent}</div>
                <div className="col-span-2 text-right flex flex-wrap items-center justify-end gap-1">
                  {o.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(o.id, 'approved')}
                        disabled={updatingId === o.id}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        审核通过
                      </button>
                      <button
                        onClick={() => updateStatus(o.id, 'cancelled')}
                        disabled={updatingId === o.id}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                      >
                        取消退回
                      </button>
                    </>
                  )}
                  {o.status === 'approved' && (
                    <>
                      <button
                        onClick={() => updateStatus(o.id, 'fulfilled')}
                        disabled={updatingId === o.id}
                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                      >
                        标记已发货
                      </button>
                      <button
                        onClick={() => updateStatus(o.id, 'cancelled')}
                        disabled={updatingId === o.id}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                      >
                        取消退回
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
