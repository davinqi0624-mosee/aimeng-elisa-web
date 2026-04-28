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
  created_at: string
  shop_items: { name: string } | null
  profiles: { full_name: string } | null
}

const STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  fulfilled: '已完成',
  cancelled: '已取消',
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchOrders = () => {
    setLoading(true)
    fetch('/api/admin/orders')
      .then((r) => r.json())
      .then((d) => setOrders(d.orders || []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
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
      if (res.ok) fetchOrders()
    } catch (err) {
      console.error(err)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-amber-600" />
          兑换订单管理
        </h1>
        <p className="text-sm text-gray-500">查看并处理用户的积分兑换订单</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">暂无兑换订单</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
            <div className="col-span-3">奖品</div>
            <div className="col-span-2">用户</div>
            <div className="col-span-2">消耗积分</div>
            <div className="col-span-2">状态</div>
            <div className="col-span-3 text-right">操作</div>
          </div>
          <div className="divide-y divide-gray-100">
            {orders.map((o) => (
              <div key={o.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3 text-sm font-medium text-gray-900 truncate">{o.shop_items?.name || '未知奖品'}</div>
                <div className="col-span-2 text-xs text-gray-600 truncate">{o.profiles?.full_name || o.user_id.slice(0, 8)}</div>
                <div className="col-span-2 text-sm text-gray-600">{o.points_spent}</div>
                <div className="col-span-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${o.status === 'pending' ? 'bg-amber-50 text-amber-700' : o.status === 'fulfilled' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'}`}>
                    {STATUS_MAP[o.status] || o.status}
                  </span>
                </div>
                <div className="col-span-3 text-right flex items-center justify-end gap-1">
                  {o.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(o.id, 'fulfilled')}
                        disabled={updatingId === o.id}
                        className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
                      >
                        完成
                      </button>
                      <button
                        onClick={() => updateStatus(o.id, 'cancelled')}
                        disabled={updatingId === o.id}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                      >
                        取消
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
