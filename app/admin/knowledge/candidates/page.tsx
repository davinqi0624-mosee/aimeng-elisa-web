'use client'

import { useCallback, useState, useEffect } from 'react'
import Link from 'next/link'
import { Alert, Button, Segmented, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  FileSearchOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

interface Candidate {
  id: string
  source_conversation_id: string | null
  source_type: string
  question: string
  answer: string
  suggested_title: string
  content: string
  category: string
  tags: string[]
  ai_quality_score: number
  ai_extract_reason: string
  status: string
  created_at: string
}

const FILTER_OPTIONS = [
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已收录' },
  { value: 'rejected', label: '已拒绝' },
]

export default function KnowledgeCandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')
  const [error, setError] = useState('')

  const loadCandidates = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/knowledge/candidates?status=${filter}`)
      const data = await res.json().catch(() => ({})) as { candidates?: Candidate[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error || '知识候选加载失败')
      setCandidates(data.candidates || [])
    } catch (err: unknown) {
      setCandidates([])
      setError(err instanceof Error ? err.message : '知识候选加载失败')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始/切换筛选时需要同步触发一次后台数据请求。
    loadCandidates()
  }, [loadCandidates])

  async function handleAction(id: string, action: string, note?: string) {
    setActionLoading(id)
    setError('')
    try {
      const res = await fetch('/api/admin/knowledge/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, note }),
      })
      if (res.ok) {
        setCandidates((prev) => prev.filter((c) => c.id !== id))
      } else {
        const data = await res.json().catch(() => ({})) as { error?: string }
        setError(data.error || '操作失败')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionLoading(null)
    }
  }

  const columns: ColumnsType<Candidate> = [
    {
      title: '内容',
      key: 'content',
      render: (_, c) => (
        <div className="min-w-0">
          <div className="mb-2 font-semibold text-slate-900">{c.suggested_title}</div>
          <div className="mb-2 text-sm text-slate-600">
            <span className="font-medium text-slate-700">问题：</span>
            {c.question}
          </div>
          <div className="mb-2 text-sm text-slate-600">
            <span className="font-medium text-slate-700">解答：</span>
            {c.answer.length > 200 ? c.answer.slice(0, 200) + '...' : c.answer}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            {c.category && <Tag>{c.category}</Tag>}
            {c.tags?.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            <span className="flex items-center gap-1">
              <ClockCircleOutlined />
              {new Date(c.created_at).toLocaleDateString('zh-CN')}
            </span>
          </div>
          {c.ai_extract_reason && (
            <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-600">
              <span className="font-medium">AI 提取理由：</span>
              {c.ai_extract_reason}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'AI 评分',
      dataIndex: 'ai_quality_score',
      key: 'ai_quality_score',
      width: 110,
      render: (score: number) => (
        <Tag color={score >= 0.7 ? 'green' : score >= 0.5 ? 'blue' : 'default'}>
          AI 评分 {score}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_, c) =>
        filter === 'pending' ? (
          <Space direction="vertical" className="w-full">
            <Button
              type="primary"
              block
              icon={<CheckOutlined />}
              loading={actionLoading === c.id}
              onClick={() => handleAction(c.id, 'approve')}
            >
              收录到 AI 知识库
            </Button>
            <Button
              block
              icon={<CloseOutlined />}
              disabled={actionLoading === c.id}
              onClick={() => handleAction(c.id, 'reject')}
            >
              拒绝
            </Button>
          </Space>
        ) : (
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={actionLoading === c.id}
            onClick={() => handleAction(c.id, 'delete')}
          >
            删除记录
          </Button>
        ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<FileSearchOutlined />}
        title="知识候选审核"
        description="AI 从客服对话中自动提取的知识候选，审核后收录到 AI 客服知识库"
        extra={
          <Link href="/admin">
            <Button icon={<ArrowLeftOutlined />}>返回概览</Button>
          </Link>
        }
      />

      {error && <Alert type="error" showIcon message={error} className="mb-4" />}

      <Segmented
        className="mb-4"
        options={FILTER_OPTIONS}
        value={filter}
        onChange={(value) => setFilter(value as string)}
      />

      <Table<Candidate>
        rowKey="id"
        columns={columns}
        dataSource={candidates}
        loading={loading}
        pagination={false}
        locale={{
          emptyText:
            filter === 'pending'
              ? '暂无待审核的知识候选'
              : `暂无${filter === 'approved' ? '已收录' : '已拒绝'}的候选`,
        }}
      />
    </div>
  )
}
