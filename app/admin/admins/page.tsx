'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  UserX,
  UserCheck,
  Shield,
  User,
  X,
  Loader2,
} from 'lucide-react'

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
          alert('请设置初始密码')
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
      const message = err instanceof Error ? err.message : '保存失败'
      setError(message)
      alert(message)
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
      const message = err instanceof Error ? err.message : '操作失败'
      setError(message)
      alert(message)
    }
  }

  async function handleDelete(admin: AdminAccount) {
    if (!confirm(`确定删除管理员 "${admin.display_name || admin.username}" 吗？此操作不可恢复。`)) return
    setError('')
    try {
      const res = await fetch(`/api/admin/accounts?id=${admin.id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({})) as ApiErrorResponse
      if (!res.ok) throw new Error(data.error || '删除失败')
      loadAdmins()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '删除失败'
      setError(message)
      alert(message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">管理员管理</h1>
          <p className="text-sm text-gray-500">管理系统管理员账号与权限</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新增管理员
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-700">用户名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">显示名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">角色</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">权限</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">状态</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">创建人</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">最后登录</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-900">{admin.username}</td>
                  <td className="px-4 py-3 text-gray-700">{admin.display_name}</td>
                  <td className="px-4 py-3">
                    {admin.role === 'super' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                        <Shield className="w-3 h-3" />
                        超级管理员
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                        <User className="w-3 h-3" />
                        管理员
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {admin.permissions.map((code) => {
                        const p = ALL_PERMISSIONS.find((x) => x.code === code)
                        return (
                          <span key={code} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">
                            {p?.label || code}
                          </span>
                        )
                      })}
                      {admin.role === 'super' && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px]">全部权限</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {admin.is_active ? (
                      <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs">正常</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 rounded text-xs">已禁用</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{admin.created_by_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {admin.last_login_at
                      ? new Date(admin.last_login_at).toLocaleString('zh-CN')
                      : '从未登录'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEdit(admin)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="编辑"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleStatus(admin)}
                        className={`p-1.5 rounded transition-colors ${
                          admin.is_active
                            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                            : 'text-gray-400 hover:text-green-600 hover:bg-green-50'
                        }`}
                        title={admin.is_active ? '禁用' : '启用'}
                      >
                        {admin.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(admin)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                {editing ? '编辑管理员' : '新增管理员'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="如 admin-zhangsan"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editing ? '重置密码（可选）' : '初始密码'}
                </label>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing}
                  minLength={form.password ? 8 : undefined}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder={editing ? '不填写则不修改密码，填写至少 8 位' : '请输入初始密码，至少 8 位'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">显示名</label>
                <input
                  type="text"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  placeholder="如 张三"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as 'super' | 'admin' })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="admin">管理员</option>
                  <option value="super">超级管理员</option>
                </select>
              </div>
              {form.role === 'admin' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">权限配置</label>
                  <div className="space-y-2">
                    {ALL_PERMISSIONS.map((perm) => (
                      <label key={perm.code} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.permissions.includes(perm.code)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setForm({ ...form, permissions: [...form.permissions, perm.code] })
                            } else {
                              setForm({ ...form, permissions: form.permissions.filter((p) => p !== perm.code) })
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editing ? '保存修改' : '创建管理员'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
