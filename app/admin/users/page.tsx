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

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = () => {
    setLoading(true)
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const exportCSV = async () => {
    if (!confirm('确定导出用户数据吗？导出记录将被审计。')) return
    const res = await fetch('/api/admin/users?export=true')
    const data = await res.json()
    if (data.error) {
      alert(data.error)
      return
    }
    const rows = data.users || []
    const headers = ['ID', '邮箱', '姓名', '角色', '积分余额', '注册时间', '最后登录']
    const csvRows = rows.map((u: any) => [
      u.id, u.email, u.full_name || '', u.role, u.balance, u.created_at, u.last_sign_in_at || '',
    ])
    const csv = [headers, ...csvRows].map((r: any[]) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
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
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            用户管理
          </h1>
          <p className="text-sm text-gray-500">查看注册用户信息与积分余额（仅限 L1 管理员）</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={users.length === 0}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          导出 CSV
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">暂无用户数据</div>
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
                    u.role === 'level1' ? 'bg-amber-50 text-amber-700' :
                    u.role === 'level2' ? 'bg-blue-50 text-blue-700' :
                    'bg-gray-50 text-gray-600'
                  }`}>
                    {u.role === 'super' ? '超级管理员' : u.role === 'level1' ? 'L1 管理员' : u.role === 'level2' ? 'L2 管理员' : '普通用户'}
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
