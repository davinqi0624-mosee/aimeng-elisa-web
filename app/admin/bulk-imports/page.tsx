'use client'

import { useCallback, useState, useEffect } from 'react'
import { Alert, App, Button, Popconfirm, Segmented, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  RollbackOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

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

type BatchesResponse = {
  batches?: Batch[]
  error?: string
  needsSetup?: boolean
}

export default function BulkImportsPage() {
  const { message } = App.useApp()
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'products' | 'agents'>('products')
  const [rollingBackId, setRollingBackId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchBatches = useCallback(() => {
    setLoading(true)
    setError('')
    fetch(`/api/admin/bulk-import-batches?type=${activeTab}`)
      .then((r) => r.json())
      .then((d: BatchesResponse) => {
        if (d.error) {
          setBatches([])
          setError(d.needsSetup ? `${d.error} 这个功能用于记录批量导入历史和支持回滚。` : d.error)
        } else {
          setBatches(d.batches || [])
        }
      })
      .catch((err: unknown) => {
        setBatches([])
        setError(err instanceof Error ? err.message : '批量导入记录加载失败')
      })
      .finally(() => setLoading(false))
  }, [activeTab])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始/切换分类时需要同步触发一次后台数据请求。
    fetchBatches()
  }, [fetchBatches])

  const handleRollback = async (batch: Batch) => {
    setRollingBackId(batch.id)
    setError('')
    try {
      const res = await fetch(`/api/admin/bulk-import-batches?id=${batch.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as { deleted?: number; failed?: number; error?: string }
      if (res.ok) {
        message.success(`回滚完成：删除 ${data.deleted ?? 0} 条，失败 ${data.failed ?? 0} 条`)
      } else {
        const msg = data.error || '回滚失败'
        setError(msg)
        message.error(msg)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '回滚请求失败'
      setError(msg)
      message.error(msg)
    }
    setRollingBackId(null)
    fetchBatches()
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const columns: ColumnsType<Batch> = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (v: string) => <span className="text-xs text-gray-600">{formatDate(v)}</span>,
    },
    {
      title: '批次 ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (v: string) => (
        <span className="font-mono text-xs text-gray-500" title={v}>
          {v.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: '数量',
      dataIndex: 'product_count',
      key: 'product_count',
      width: 70,
    },
    {
      title: '图片',
      dataIndex: 'image_count',
      key: 'image_count',
      width: 70,
    },
    {
      title: '导入结果',
      key: 'result',
      width: 150,
      render: (_, batch) => (
        <div className="text-xs">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600">{batch.details?.success ?? 0} 成功</span>
            <span className="text-red-500">{batch.details?.failed ?? 0} 失败</span>
          </div>
          {batch.details?.skippedImages ? (
            <div className="mt-0.5 text-amber-600">{batch.details.skippedImages} 图片跳过</div>
          ) : null}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: Batch['status']) =>
        v === 'completed' ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>已完成</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />}>已回滚</Tag>
        ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 170,
      render: (_, batch) =>
        batch.status === 'completed' ? (
          <Popconfirm
            title="确定回滚该批次？"
            description={
              <div className="whitespace-pre-line" style={{ fontSize: 12 }}>
                {`类型：${batch.type === 'products' ? '商品' : '代理商'}\n数量：${batch.product_count}\n\n回滚将删除该批次导入的所有记录。`}
              </div>
            }
            okText="回滚"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => {
              handleRollback(batch)
            }}
          >
            <Button danger size="small" icon={<RollbackOutlined />} loading={rollingBackId === batch.id}>
              回滚
            </Button>
          </Popconfirm>
        ) : batch.details?.rollback_result ? (
          <span className="text-xs text-gray-400">
            已删 {batch.details.rollback_result.deleted} / 失败 {batch.details.rollback_result.failed}
          </span>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<HistoryOutlined />}
        title="批量导入记录"
        description="查看和管理商品、代理商的批量导入批次，支持回滚操作"
        extra={
          <Segmented
            value={activeTab}
            onChange={(v) => setActiveTab(v as 'products' | 'agents')}
            options={[
              { label: '商品导入', value: 'products', icon: <AppstoreOutlined /> },
              { label: '代理商导入', value: 'agents', icon: <EnvironmentOutlined /> },
            ]}
          />
        }
      />

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Table<Batch>
        rowKey="id"
        columns={columns}
        dataSource={batches}
        loading={loading}
        locale={{ emptyText: '暂无导入记录' }}
        pagination={false}
        scroll={{ x: 900 }}
      />
    </div>
  )
}
