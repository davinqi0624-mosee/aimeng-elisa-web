'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_token: '验证链接不完整，请重新查收邮件',
  invalid_token: '验证链接无效或已过期，请重新注册或联系管理员',
  server_error: '验证服务异常，请稍后重试',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/chat'

  const authError = searchParams.get('auth_error')
  const verified = searchParams.get('verified')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setNotice('')
    setLoading(true)

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
      window.location.href = next
    } catch {
      setError('网络异常，请稍后重试')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl flex flex-col lg:flex-row lg:items-stretch items-center justify-center gap-8 lg:gap-12">
          <div className="w-full max-w-[320px] lg:max-w-[340px] flex items-center justify-center lg:items-stretch lg:self-stretch">
            <div className="relative w-full h-[360px] lg:h-full rounded-lg overflow-hidden bg-white shadow-sm border border-slate-200">
              <Image
                src="/brand/login-lab-specialist.jpg"
                alt="AIMENG UNING AI 客服形象"
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 340px"
                className="object-cover object-center"
              />
            </div>
          </div>

          <div className="w-full max-w-md flex items-center justify-center lg:items-stretch lg:self-stretch">
            <div className="w-full h-full bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm flex flex-col justify-center">
              <div className="mb-8">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                  account.access / sign in
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                  登录您的账户
                </h1>
              </div>

              {verified === '1' && !error && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  邮箱验证成功，50 积分已发放，请登录。
                </div>
              )}
              {authError && !error && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-sm text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {AUTH_ERROR_MESSAGES[authError] || '链接无效或已过期'}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                    placeholder="请输入邮箱"
                  />
                </div>
                <div>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-slate-600">密码</label>
                    <Link href="/forgot-password" className="text-xs font-medium text-teal-700 hover:text-teal-800">
                      忘记密码？
                    </Link>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                    placeholder="请输入密码"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-slate-950 text-white font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  登录
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                还没有账户？{' '}
                <Link href="/register" className="text-teal-700 hover:text-teal-800 font-semibold">
                  立即注册
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
