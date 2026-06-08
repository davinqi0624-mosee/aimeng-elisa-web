'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FlaskConical, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import Navbar from '@/components/Navbar'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [organization, setOrganization] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          organization,
          phone,
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B]">
        <Navbar />
        <div className="pt-16 min-h-[calc(100vh-64px)] flex items-center justify-center px-4">
          <div className="w-full max-w-md text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-[#1E293B] mb-2">注册成功</h2>
            <p className="text-sm text-[#94A3B8] mb-6">请查收您的邮箱，点击验证链接完成注册。</p>
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
      <Navbar />
      <div className="pt-16 min-h-[calc(100vh-64px)] flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-blue-600 font-bold text-xl">
              <FlaskConical className="w-6 h-6" />
              <span>AIMENG UNING</span>
            </Link>
            <p className="text-sm text-[#94A3B8] mt-2">创建您的新账户</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
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
  )
}