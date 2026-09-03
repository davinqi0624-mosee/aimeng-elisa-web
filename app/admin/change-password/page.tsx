'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from 'lucide-react'

export default function AdminChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetch('/api/admin/me')
      .then((res) => {
        if (!res.ok) router.replace('/admin/login')
      })
      .catch(() => router.replace('/admin/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || '修改密码失败')
        return
      }

      setSuccess(data.message || '密码已修改，请重新登录')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      window.setTimeout(() => router.replace('/admin/login'), 1200)
    } catch {
      setError('无法连接服务器，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-md">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          返回后台
        </Link>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl shadow-black/20">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">修改管理员密码</h1>
              <p className="mt-1 text-sm text-slate-400">修改后需要使用新密码重新登录后台。</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-3 text-sm text-red-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="当前密码"
              value={currentPassword}
              showPassword={showPassword}
              onChange={setCurrentPassword}
            />
            <PasswordField
              label="新密码"
              value={newPassword}
              showPassword={showPassword}
              onChange={setNewPassword}
            />
            <PasswordField
              label="确认新密码"
              value={confirmPassword}
              showPassword={showPassword}
              onChange={setConfirmPassword}
            />

            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showPassword ? '隐藏密码' : '显示密码'}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              确认修改
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function PasswordField({
  label,
  value,
  showPassword,
  onChange,
}: {
  label: string
  value: string
  showPassword: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-300">{label}</span>
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        minLength={8}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-400"
      />
    </label>
  )
}
