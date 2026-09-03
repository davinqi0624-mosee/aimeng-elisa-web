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
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#1E293B] mb-2">注册成功</h2>
            <p className="text-sm text-[#94A3B8] mb-6">请查收邮箱并完成验证，验证成功后将自动发放50积分。</p>
            <Link
              href="/login"
              className="inline-block px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white font-medium hover:shadow-lg transition-all"
            >
              去登录
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row lg:items-stretch items-center justify-center gap-8 lg:gap-12 xl:gap-16">
          <div className="w-full max-w-[360px] lg:max-w-[400px] flex items-center justify-center lg:items-stretch lg:self-stretch">
            <div className="relative w-full h-[420px] lg:h-full rounded-[28px] overflow-hidden bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)] border border-white/70">
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
            <div className="w-full h-full bg-white/95 border border-gray-200 rounded-[24px] p-6 sm:p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)] flex flex-col justify-center">
              <div className="text-center mb-8">
                <p className="text-[34px] sm:text-[38px] font-extrabold leading-tight text-[#2563EB] tracking-normal">
                  创建您的新账户
                </p>
                <p className="mt-2 text-sm font-medium text-amber-600">注册会员即送50积分</p>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">姓名</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F6F8FB] border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    placeholder="请输入姓名"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">邮箱</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F6F8FB] border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    placeholder="请输入邮箱"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">密码</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F6F8FB] border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    placeholder="至少6位字符"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">单位/机构</label>
                  <input
                    type="text"
                    value={organization}
                    onChange={(e) => setOrganization(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F6F8FB] border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    placeholder="请输入单位名称（选填）"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">电话</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F6F8FB] border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
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
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  注册
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[#94A3B8]">
                已有账户？{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
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
