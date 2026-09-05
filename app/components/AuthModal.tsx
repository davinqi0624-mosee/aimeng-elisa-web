'use client'

import { useState } from 'react'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (isLogin) {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        const data = await response.json()
        if (!response.ok) {
          setError(data.error || '登录失败')
          setLoading(false)
          return
        }
        if (data.mustChangePassword) {
          window.location.href = '/change-password?forced=1'
          return
        }
        onClose()
        window.location.reload()
      } catch {
        setError('网络异常，请稍后重试')
        setLoading(false)
      }
    } else {
      window.location.href = `/register?email=${encodeURIComponent(email)}`
      return
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 text-lg"
        >
          ✕
        </button>
        <h2 className="text-2xl font-bold mb-4">{isLogin ? '登录' : '注册'}</h2>
        {!isLogin && <p className="mb-4 text-sm text-amber-600">注册会员即送50积分</p>}
        {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="border p-2 rounded"
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border p-2 rounded"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '加载中...' : isLogin ? '登录' : '注册'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? '还没有账号？' : '已有账号？'}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-500 underline ml-1"
          >
            {isLogin ? '注册' : '登录'}
          </button>
        </p>
      </div>
    </div>
  )
}
