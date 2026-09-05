'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'

// 登录态修改密码：当前密码 + 新密码。管理员设置的初始密码（must_change_password）
// 登录后会被引导到本页（?forced=1）。
export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const forced = searchParams.get('forced') === '1'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')

    if (password.length < 6) {
      setError('新密码至少需要 6 位字符')
      return
    }
    if (password !== confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '密码修改失败')
      setMessage('密码已更新。')
      setTimeout(() => router.push(forced ? '/chat' : '/user/member'), 1200)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '密码修改失败')
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
                alt="AIMENG UNING 账户安全"
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
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                  <KeyRound className="h-5 w-5" />
                </div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[.28em] text-teal-700">
                  account.access / change
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                  {forced ? '请设置新密码' : '修改密码'}
                </h1>
                {forced && (
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    当前使用的是初始密码，为保障账户安全请先设置新密码。
                  </p>
                )}
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-4 p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-start gap-2 text-sm text-teal-800">
                  <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0" />
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">当前密码</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                    placeholder="请输入当前密码"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">新密码</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-2.5 pr-12 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                      placeholder="至少 6 位字符"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                      aria-label={showPassword ? '隐藏新密码' : '显示新密码'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">确认新密码</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                    placeholder="再次输入新密码"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-slate-950 text-white font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  更新密码
                </button>
              </form>

              {!forced && (
                <div className="mt-6 text-center text-sm text-slate-500">
                  <Link href="/user/member" className="text-teal-700 hover:text-teal-800 font-semibold">
                    返回个人中心
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
