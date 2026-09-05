'use client'

import { useState, useEffect } from 'react'
import { Alert, App, Button, Popconfirm, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { DownloadOutlined, ReloadOutlined, TeamOutlined } from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  balance: number
  created_at: string
  last_sign_in_at: string | null
}

type CsvCell = string | number | null

function getRoleLabel(role: string) {
  if (role === 'super') return '超级管理员'
  if (role === 'admin_l1' || role === 'level1') return 'L1 管理员'
  if (role === 'admin_l2' || role === 'level2') return 'L2 管理员'
  return '普通用户'
}

function getRoleTag(role: string) {
  if (role === 'super') return <Tag color="red">{getRoleLabel(role)}</Tag>
  if (role === 'admin_l1' || role === 'level1') return <Tag color="gold">{getRoleLabel(role)}</Tag>
  if (role === 'admin_l2' || role === 'level2') return <Tag color="processing">{getRoleLabel(role)}</Tag>
  return <Tag>{getRoleLabel(role)}</Tag>
}

export default function AdminUsersPage() {
  const { message } = App.useApp()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const fetchUsers = () => {
    setLoading(true)
    setError('')
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setUsers([])
          setError(d.error)
        } else {
          setUsers(d.users || [])
        }
      })
      .catch((err: unknown) => {
        setUsers([])
        setError(err instanceof Error ? err.message : '用户加载失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    fetchUsers()
  }, [])

  const exportCSV = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/users?export=true')
      const data = await res.json() as { error?: string; users?: User[] }
      if (data.error) {
        message.error(data.error)
        return
      }
      const rows = data.users || []
      const headers = ['ID', '邮箱', '姓名', '角色', '积分余额', '注册时间', '最后登录']
      const csvRows: CsvCell[][] = rows.map((u) => [
        u.id, u.email, u.full_name || '', u.role, u.balance, u.created_at, u.last_sign_in_at || '',
      ])
      const csv = [headers, ...csvRows].map((r: CsvCell[]) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success(`已导出 ${rows.length} 条用户数据`)
    } catch {
      message.error('导出失败，请稍后重试')
    } finally {
      setExporting(false)
    }
  }

  const columns: ColumnsType<User> = [
    {
      title: '邮箱 / 姓名',
      key: 'email',
      render: (_, u) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">{u.email}</div>
          <div className="truncate text-xs text-slate-500">{u.full_name || '-'}</div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => getRoleTag(role),
    },
    {
      title: '积分余额',
      dataIndex: 'balance',
      key: 'balance',
      width: 100,
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v: string) => <span className="text-xs text-slate-500">{new Date(v).toLocaleDateString('zh-CN')}</span>,
    },
    {
      title: '最后登录',
      dataIndex: 'last_sign_in_at',
      key: 'last_sign_in_at',
      width: 120,
      render: (v: string | null) => <span className="text-xs text-slate-500">{v ? new Date(v).toLocaleDateString('zh-CN') : '-'}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<TeamOutlined />}
        title="用户管理"
        description="查看注册用户信息与积分余额（仅限超级管理员）"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchUsers} loading={loading}>
              刷新
            </Button>
            <Popconfirm
              title="确定导出用户数据吗？"
              description="导出记录将被审计。"
              onConfirm={exportCSV}
              okText="导出"
              cancelText="取消"
            >
              <Button type="primary" icon={<DownloadOutlined />} disabled={users.length === 0} loading={exporting}>
                导出 CSV
              </Button>
            </Popconfirm>
          </Space>
        }
      />

      {error && <Alert type="error" showIcon message={error} className="mb-4" style={{ marginBottom: 16 }} />}

      <Table<User>
        rowKey="id"
        columns={columns}
        dataSource={users}
        loading={loading}
        locale={{ emptyText: '暂无用户数据' }}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 名用户` }}
      />
    </div>
  )
}
