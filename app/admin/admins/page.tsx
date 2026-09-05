'use client'

import { useState, useEffect } from 'react'
import { Alert, App, Button, Checkbox, Input, Modal, Popconfirm, Select, Space, Table, Tag } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons'
import PageHeader from '@/components/admin/PageHeader'

interface AdminAccount {
  id: string
  username: string
  role: 'super' | 'admin'
  display_name: string
  is_active: boolean
  created_by_name: string
  created_at: string
  last_login_at: string | null
  permissions: string[]
}

interface AdminAccountPayload {
  id?: string
  username?: string
  password?: string
  role?: 'super' | 'admin'
  display_name?: string
  permissions?: string[]
  is_active?: boolean
}

interface ApiErrorResponse {
  error?: string
}

const ALL_PERMISSIONS = [
  { code: 'product_manage', label: '商品管理' },
  { code: 'points_review', label: '积分审核' },
  { code: 'citation_review', label: '文献审核' },
  { code: 'datasheet_generate', label: '说明书生成' },
  { code: 'order_manage', label: '订单管理' },
  { code: 'user_manage', label: '用户管理' },
  { code: 'system_settings', label: '系统设置' },
]

export default function AdminManagementPage() {
  const { message } = App.useApp()
  const [admins, setAdmins] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminAccount | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    username: '',
    password: '',
    role: 'admin' as 'super' | 'admin',
    display_name: '',
    permissions: [] as string[],
  })

  useEffect(() => {
    loadAdmins()
  }, [])

  async function loadAdmins() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/accounts')
      const data = await res.json().catch(() => ({})) as { accounts?: AdminAccount[]; error?: string }
      if (!res.ok || data.error) throw new Error(data.error || '管理员列表加载失败')
      setAdmins(data.accounts || [])
    } catch (err: unknown) {
      setAdmins([])
      setError(err instanceof Error ? err.message : '管理员列表加载失败')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(null)
    setForm({
      username: '',
      password: '',
      role: 'admin',
      display_name: '',
      permissions: [],
    })
    setShowModal(true)
  }

  function openEdit(admin: AdminAccount) {
    setEditing(admin)
    setForm({
      username: admin.username,
      password: '',
      role: admin.role,
      display_name: admin.display_name,
      permissions: admin.permissions,
    })
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      if (editing) {
        const body: AdminAccountPayload = {
          id: editing.id,
          username: form.username.trim(),
          display_name: form.display_name.trim(),
          role: form.role,
          permissions: form.permissions,
        }
        if (form.password.trim()) {
          body.password = form.password.trim()
        }
        const res = await fetch('/api/admin/accounts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => ({})) as ApiErrorResponse
        if (!res.ok) throw new Error(data.error || '更新失败')
      } else {
        if (!form.password) {
          message.error('请设置初始密码')
          setSubmitting(false)
          return
        }
        const res = await fetch('/api/admin/accounts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json().catch(() => ({})) as ApiErrorResponse
        if (!res.ok) throw new Error(data.error || '创建失败')
      }
      setShowModal(false)
      loadAdmins()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '保存失败'
      setError(errorMessage)
      message.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  async function toggleStatus(admin: AdminAccount) {
    setError('')
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: admin.id,
          is_active: !admin.is_active,
        }),
      })
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      if (!res.ok) throw new Error(data.error || '操作失败')
      loadAdmins()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '操作失败'
      setError(errorMessage)
      message.error(errorMessage)
    }
  }

  async function handleDelete(admin: AdminAccount) {
    setError('')
    try {
      const res = await fetch(`/api/admin/accounts?id=${admin.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      if (!res.ok) throw new Error(data.error || '删除失败')
      loadAdmins()
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '删除失败'
      setError(errorMessage)
      message.error(errorMessage)
    }
  }

  const columns: ColumnsType<AdminAccount> = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 150,
      render: (username: string) => <span className="font-mono">{username}</span>,
    },
    {
      title: '显示名',
      dataIndex: 'display_name',
      key: 'display_name',
      width: 120,
      render: (name: string) => <span className="text-slate-700">{name}</span>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: 'super' | 'admin') =>
        role === 'super' ? (
          <Tag color="gold">超级管理员</Tag>
        ) : (
          <Tag color="processing">管理员</Tag>
        ),
    },
    {
      title: '权限',
      key: 'permissions',
      render: (_, admin) => (
        <div className="flex flex-wrap gap-1">
          {admin.permissions.map((code) => {
            const p = ALL_PERMISSIONS.find((x) => x.code === code)
            return <Tag key={code}>{p?.label || code}</Tag>
          })}
          {admin.role === 'super' && <Tag>全部权限</Tag>}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 90,
      render: (active: boolean) =>
        active ? <Tag color="green">正常</Tag> : <Tag color="volcano">已禁用</Tag>,
    },
    {
      title: '创建人',
      dataIndex: 'created_by_name',
      key: 'created_by_name',
      width: 110,
      render: (name: string) => <span className="text-slate-500">{name}</span>,
    },
    {
      title: '最后登录',
      dataIndex: 'last_login_at',
      key: 'last_login_at',
      width: 150,
      render: (v: string | null) => (
        <span className="text-xs text-slate-500">
          {v ? new Date(v).toLocaleString('zh-CN') : '从未登录'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, admin) => (
        <Space>
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEdit(admin)}
            title="编辑"
          />
          <Button
            type="text"
            danger={admin.is_active}
            icon={admin.is_active ? <StopOutlined /> : <CheckCircleOutlined />}
            onClick={() => toggleStatus(admin)}
            title={admin.is_active ? '禁用' : '启用'}
          />
          <Popconfirm
            title={`确定删除管理员 "${admin.display_name || admin.username}" 吗？此操作不可恢复。`}
            onConfirm={() => handleDelete(admin)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />} title="删除" />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        icon={<SafetyCertificateOutlined />}
        title="管理员管理"
        description="管理系统管理员账号与权限"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增管理员
          </Button>
        }
      />

      {error && <Alert type="error" showIcon message={error} className="mb-4" />}

      <Table<AdminAccount>
        rowKey="id"
        columns={columns}
        dataSource={admins}
        loading={loading}
        scroll={{ x: 1000 }}
        locale={{ emptyText: '暂无管理员账号' }}
        pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 个管理员` }}
      />

      <Modal
        open={showModal}
        title={editing ? '编辑管理员' : '新增管理员'}
        onCancel={() => setShowModal(false)}
        footer={null}
        maskClosable={false}
        keyboard={false}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">用户名</label>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              placeholder="如 admin-zhangsan"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              {editing ? '重置密码（可选）' : '初始密码'}
            </label>
            <Input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editing}
              minLength={form.password ? 8 : undefined}
              placeholder={editing ? '不填写则不修改密码，填写至少 8 位' : '请输入初始密码，至少 8 位'}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">显示名</label>
            <Input
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="如 张三"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">角色</label>
            <Select<'super' | 'admin'>
              className="w-full"
              value={form.role}
              onChange={(value) => setForm({ ...form, role: value })}
              options={[
                { value: 'admin', label: '管理员' },
                { value: 'super', label: '超级管理员' },
              ]}
            />
          </div>
          {form.role === 'admin' && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">权限配置</label>
              <div className="space-y-2">
                {ALL_PERMISSIONS.map((perm) => (
                  <Checkbox
                    key={perm.code}
                    checked={form.permissions.includes(perm.code)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setForm({ ...form, permissions: [...form.permissions, perm.code] })
                      } else {
                        setForm({ ...form, permissions: form.permissions.filter((p) => p !== perm.code) })
                      }
                    }}
                  >
                    {perm.label}
                  </Checkbox>
                ))}
              </div>
            </div>
          )}
          <div className="pt-2">
            <Button type="primary" htmlType="submit" block loading={submitting}>
              {editing ? '保存修改' : '创建管理员'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
