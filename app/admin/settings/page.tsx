'use client'

import { useState, useEffect } from 'react'
import { Settings, Shield, Loader2, AlertCircle } from 'lucide-react'

export default function AdminSettingsPage() {
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => {
        setRole(d.role || null)
        setLoading(false)
      })
      .catch(() => {
        setRole(null)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (role !== 'super') {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center">
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p className="text-sm text-gray-500">仅超级管理员可访问系统设置</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-gray-600" />
          系统设置
        </h1>
        <p className="text-sm text-gray-500">系统环境变量与 API 配置（仅 super 可见）</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
          <Shield className="w-5 h-5 text-blue-600" />
          <div>
            <h3 className="text-sm font-medium text-gray-900">环境变量</h3>
            <p className="text-xs text-gray-500">请在 Vercel/服务器环境变量中管理以下配置</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 text-sm">
          {[
            { key: 'NEXT_PUBLIC_SUPABASE_URL', desc: 'Supabase 项目 URL' },
            { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', desc: 'Supabase 匿名密钥' },
            { key: 'DEEPSEEK_API_KEY', desc: 'DeepSeek API 密钥' },
            { key: 'OLLAMA_HOST', desc: 'Ollama 本地服务地址（可选）' },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
              <code className="text-xs font-mono text-gray-700">{item.key}</code>
              <span className="text-xs text-gray-500">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm text-amber-800 font-medium">安全提示</p>
        <p className="text-xs text-amber-700 mt-1">
          API Key 与数据库密钥属于敏感信息，请勿在客户端代码中硬编码。如需修改，请通过 Vercel Dashboard 或服务器环境变量管理。
        </p>
      </div>
    </div>
  )
}
