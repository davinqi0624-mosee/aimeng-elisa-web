'use client'

import { useState, useEffect } from 'react'
import { Alert, Button, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { OrderedListOutlined } from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

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

const STATUS_COLOR_MAP: Record<string, string> = {
  pending: 'gold',
  approved: 'processing',
  fulfilled: 'green',
  cancelled: 'default',
}

function getStatusTag(status: string) {
  return <Tag color={STATUS_COLOR_MAP[status] || 'default'}>{STATUS_MAP[status] || status}</Tag>
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

  const columns: ColumnsType<Order> = [
    {
      title: '奖品',
      key: 'item',
      width: 200,
      render: (_, o) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{o.shop_items?.name || '未知奖品'}</div>
          <div className="mt-1 text-xs text-gray-400">{new Date(o.created_at).toLocaleString('zh-CN')}</div>
          <div className="mt-2">{getStatusTag(o.status)}</div>
        </div>
      ),
    },
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_, o) => (
        <div className="text-xs text-gray-600">
          <div className="truncate">{o.profiles?.full_name || o.user_id.slice(0, 8)}</div>
          <div className="mt-1 truncate text-gray-500">{o.user_email || '未获取邮箱'}</div>
          <div className="mt-1 truncate text-gray-400">{o.user_id}</div>
        </div>
      ),
    },
    {
      title: '收货信息',
      key: 'shipping',
      render: (_, o) => (
        <div className="text-xs leading-5 text-gray-600">
          <div className="font-medium text-gray-900">{o.contact_name || '未填写'} · {o.contact_phone || '未填写电话'}</div>
          <div>{o.contact_email || '未填写邮箱'}</div>
          <div className="mt-1 whitespace-pre-wrap text-gray-700">{o.shipping_address || '未填写收货地址'}</div>
          {o.shipping_note && <div className="mt-1 text-amber-700">备注：{o.shipping_note}</div>}
          {o.remark && <div className="mt-1 text-slate-500">后台备注：{o.remark}</div>}
        </div>
      ),
    },
    {
      title: '积分',
      dataIndex: 'points_spent',
      key: 'points_spent',
      width: 80,
      render: (v: number) => <span className="text-sm font-semibold text-amber-600">{v}</span>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, o) => (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {o.status === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                loading={updatingId === o.id}
                onClick={() => updateStatus(o.id, 'approved')}
              >
                审核通过
              </Button>
              <Button
                size="small"
                loading={updatingId === o.id}
                onClick={() => updateStatus(o.id, 'cancelled')}
              >
                取消退回
              </Button>
            </>
          )}
          {o.status === 'approved' && (
            <>
              <Button
                size="small"
                type="primary"
                loading={updatingId === o.id}
                onClick={() => updateStatus(o.id, 'fulfilled')}
              >
                标记已发货
              </Button>
              <Button
                size="small"
                loading={updatingId === o.id}
                onClick={() => updateStatus(o.id, 'cancelled')}
              >
                取消退回
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader icon={<OrderedListOutlined />} title="兑换订单管理" description="查看并处理用户的积分兑换订单" />

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Table<Order>
        rowKey="id"
        columns={columns}
        dataSource={orders}
        loading={loading}
        locale={{ emptyText: '暂无兑换订单' }}
        pagination={false}
        scroll={{ x: 1000 }}
      />
    </div>
  )
}
