'use client'

import { useState, useEffect } from 'react'
import { Users, Loader2, Download } from 'lucide-react'

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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      .catch((err) => {
        setUsers([])
        setError(err.message || '用户加载失败')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 初始加载需要同步触发一次后台数据请求。
    fetchUsers()
  }, [])

  const exportCSV = async () => {
    if (!confirm('确定导出用户数据吗？导出记录将被审计。')) return
    const res = await fetch('/api/admin/users?export=true')
    const data = await res.json() as { error?: string; users?: User[] }
    if (data.error) {
      alert(data.error)
      return
    }
    const rows = data.users || []
    const headers = ['ID', '邮箱', '姓名', '角色', '积分余额', '注册时间', '最后登录']
    const csvRows: CsvCell[][] = rows.map((u) => [
      u.id, u.email, u.full_name || '', u.role, u.balance, u.created_at, u.last_sign_in_at || '',
    ])
    const csv = [headers, ...csvRows].map((r: CsvCell[]) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-300" />
            用户管理
          </h1>
          <p className="text-sm text-slate-300">查看注册用户信息与积分余额（仅限超级管理员）</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={users.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          导出 CSV
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-slate-300 text-sm">暂无用户数据</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-50 text-xs font-medium text-gray-500 border-b border-gray-200">
            <div className="col-span-3">邮箱 / 姓名</div>
            <div className="col-span-2">角色</div>
            <div className="col-span-2">积分余额</div>
            <div className="col-span-3">注册时间</div>
            <div className="col-span-2">最后登录</div>
          </div>
          <div className="divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3">
                  <div className="text-sm font-medium text-gray-900 truncate">{u.email}</div>
                  <div className="text-xs text-gray-500 truncate">{u.full_name || '-'}</div>
                </div>
                <div className="col-span-2">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                    u.role === 'super' ? 'bg-red-50 text-red-700' :
                    u.role === 'admin_l1' || u.role === 'level1' ? 'bg-amber-50 text-amber-700' :
                    u.role === 'admin_l2' || u.role === 'level2' ? 'bg-blue-50 text-blue-700' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {getRoleLabel(u.role)}
                  </span>
                </div>
                <div className="col-span-2 text-sm text-gray-600">{u.balance}</div>
                <div className="col-span-3 text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString('zh-CN')}</div>
                <div className="col-span-2 text-xs text-gray-500">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('zh-CN') : '-'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
