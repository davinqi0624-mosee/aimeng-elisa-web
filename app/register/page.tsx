'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import TurnstileWidget from '@/components/security/TurnstileWidget'

const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [organization, setOrganization] = useState('')
  const [phone, setPhone] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (turnstileSiteKey && !turnstileToken) {
      setError('请先完成人机验证')
      return
    }
    setLoading(true)

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName, organization, phone, turnstileToken }),
      })
      const data = await response.json()
      if (!response.ok || data.error) throw new Error(data.error || '注册失败')
      setSuccess(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '注册失败')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
        <div className="min-h-screen flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md text-center">
            <CheckCircle2 className="w-12 h-12 text-teal-600 mx-auto mb-4" />
            <h2 className="text-2xl font-black tracking-normal text-slate-950 mb-2">注册成功</h2>
            <p className="text-sm text-slate-500 mb-6">请查收邮箱并完成验证，验证成功后将自动发放50积分。</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 rounded-lg bg-slate-950 text-white font-bold hover:bg-teal-700 transition-colors"
            >
              去登录
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const inputClass =
    'w-full px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-500'
  const labelClass = 'block text-sm font-medium text-slate-600 mb-1'

  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row lg:items-stretch items-center justify-center gap-8 lg:gap-12 xl:gap-16">
          <div className="w-full max-w-[360px] lg:max-w-[400px] flex items-center justify-center lg:items-stretch lg:self-stretch">
            <div className="relative w-full h-[420px] lg:h-full rounded-lg overflow-hidden bg-white shadow-sm border border-slate-200">
              <Image
                src="/brand/auth-customer-service.jpg"
                alt="AIMENG UNING AI 客服形象"
                fill
                priority
                sizes="(max-width: 1024px) 90vw, 400px"
                className="object-cover object-center"
              />
            </div>
          </div>

          <div className="w-full max-w-[560px] flex items-center justify-center lg:items-stretch lg:self-stretch">
            <div className="w-full h-full bg-white border border-slate-200 rounded-lg p-6 sm:p-8 shadow-sm flex flex-col justify-center">
              <div className="mb-8">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
                  account.access / register
                </p>
                <h1 className="mt-3 text-2xl font-black tracking-normal text-slate-950 sm:text-3xl">
                  创建您的新账户
                </h1>
                <p className="mt-2 text-sm font-medium text-teal-700">注册会员即送50积分</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>姓名</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="请输入姓名"
                  />
                </div>
                <div>
                  <label className={labelClass}>邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="请输入邮箱"
                  />
                </div>
                <div>
                  <label className={labelClass}>密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className={inputClass}
                    placeholder="至少6位字符"
                  />
                </div>
                <div>
                  <label className={labelClass}>单位/机构</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className={inputClass}
                    placeholder="请输入单位名称（选填）"
                  />
                </div>
                <div>
                  <label className={labelClass}>电话</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="请输入联系电话（选填）"
                  />
                </div>
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  action="user_register"
                  onTokenChange={setTurnstileToken}
                  className="flex justify-center"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-slate-950 text-white font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  注册
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-slate-500">
                已有账户？{' '}
                <Link href="/login" className="text-teal-700 hover:text-teal-800 font-semibold">
                  立即登录
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
