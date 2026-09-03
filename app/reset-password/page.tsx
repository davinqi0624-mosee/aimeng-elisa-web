'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function normalizePasswordError(message: string) {
  const text = message.trim()
  if (!text) return '密码重置失败，请重新打开邮件中的链接'
  if (text === 'New password should be different from the old password.') {
    return '新密码不能和旧密码相同，请重新输入。'
  }
  if (text.toLowerCase().includes('password should be different')) {
    return '新密码不能和旧密码相同，请重新输入。'
  }
  return text
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingLink, setCheckingLink] = useState(true)
  const [sessionReady, setSessionReady] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    let active = true

    async function prepareRecoverySession() {
      setError('')
      try {
        const url = new URL(window.location.href)
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
        const code = url.searchParams.get('code')
        const authError = url.searchParams.get('auth_error')
        const errorDescription = url.searchParams.get('error_description') || hashParams.get('error_description')

        if (errorDescription) {
          throw new Error(decodeURIComponent(errorDescription))
        }
        if (authError) {
          throw new Error('重置链接已失效或不完整，请返回找回密码页面重新发送邮件，并从最新邮件链接进入。')
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
          window.history.replaceState(null, '', '/reset-password')
        } else {
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (sessionError) throw sessionError
            window.history.replaceState(null, '', '/reset-password')
          }
        }

        const { data } = await supabase.auth.getSession()
        if (!active) return
        setSessionReady(Boolean(data.session))
      } catch (err: unknown) {
        if (!active) return
        setSessionReady(false)
        setError(err instanceof Error ? err.message : '重置链接验证失败，请重新发送密码重置邮件')
      } finally {
        if (active) setCheckingLink(false)
      }
    }

    void prepareRecoverySession()

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSessionReady(true)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [supabase])

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
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setSessionReady(false)
        throw new Error('重置链接已失效或没有被浏览器完整打开，请返回找回密码页面重新发送邮件，并从邮件中的最新链接进入。')
      }
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setMessage('密码已重置成功，请使用新密码登录。')
      setPassword('')
      setConfirmPassword('')
      await supabase.auth.signOut()
    } catch (err: unknown) {
      setError(normalizePasswordError(err instanceof Error ? err.message : '密码重置失败，请重新打开邮件中的链接'))
    } finally {
      setLoading(false)
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
                alt="AIMENG UNING 账户安全"
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
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h1 className="text-[30px] sm:text-[34px] font-extrabold leading-tight text-[#2563EB] tracking-normal">
                  设置新密码
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  请设置一个新的登录密码，完成后重新登录账户。
                </p>
              </div>

              {!sessionReady && !message && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-sm text-amber-800">
                  <AlertCircle className="mt-0.5 w-4 h-4 shrink-0" />
                  {checkingLink ? '正在验证邮件中的重置链接...' : '如果无法设置密码，请从邮箱中的最新重置链接重新打开本页面。'}
                </div>
              )}
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 w-4 h-4 shrink-0" />
                  {message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#475569] mb-1">新密码</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-2.5 pr-12 rounded-xl bg-[#F6F8FB] border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
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
                  <label className="block text-sm font-medium text-[#475569] mb-1">确认新密码</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      minLength={6}
                      className="w-full px-4 py-2.5 pr-12 rounded-xl bg-[#F6F8FB] border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                      placeholder="再次输入新密码"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                      aria-label={showConfirmPassword ? '隐藏确认密码' : '显示确认密码'}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || checkingLink || !sessionReady}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white font-medium hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {checkingLink ? '正在验证链接...' : '重置密码'}
                </button>
              </form>

              <div className="mt-6 text-center text-sm text-[#94A3B8]">
                已完成重置？{' '}
                <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
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
