'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, CheckCircle2, Loader2, Mail } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试')
      setMessage(data.message || '如果该邮箱已注册，重置邮件已发送，请查收。')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '发送重置邮件失败，请稍后重试')
    } finally {
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
                alt="AIMENG UNING 客服支持"
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
                  <Mail className="h-5 w-5" />
                </div>
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                  account.access / recover
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                  找回密码
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  输入注册邮箱，系统会发送一封密码重置邮件。
                </p>
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
                  <label className="block text-sm font-medium text-slate-600 mb-1">注册邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500"
                    placeholder="请输入注册邮箱"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-slate-950 text-white font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  发送重置邮件
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                想起密码了？{' '}
                <Link href="/login" className="text-teal-700 hover:text-teal-800 font-semibold">
                  返回登录
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
