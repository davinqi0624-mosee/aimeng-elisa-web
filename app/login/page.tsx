'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/chat'

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
    } else {
      window.location.href = next
    }
  }

  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl flex flex-col lg:flex-row lg:items-stretch items-center justify-center gap-8 lg:gap-12">
          <div className="w-full max-w-[320px] lg:max-w-[340px] flex items-center justify-center lg:items-stretch lg:self-stretch">
            <div className="relative w-full h-[360px] lg:h-full rounded-[28px] overflow-hidden bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)] border border-white/70">
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
            <div className="w-full h-full bg-white/95 border border-gray-200 rounded-[24px] p-6 sm:p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)] flex flex-col justify-center">
              <div className="text-center mb-8">
                <Link href="/" className="inline-block text-[34px] sm:text-[38px] font-extrabold leading-tight text-[#2563EB] tracking-normal">
                  登录您的账户
                </Link>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-[#475569]">密码</label>
                    <Link href="/forgot-password" className="text-xs font-medium text-blue-600 hover:text-blue-700">
                      忘记密码？
                    </Link>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl bg-[#F6F8FB] border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    placeholder="请输入密码"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  登录
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[#94A3B8]">
                还没有账户？{' '}
                <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
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
