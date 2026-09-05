import { NextRequest, NextResponse } from 'next/server'
import { verifyTurnstileToken } from '@/lib/security/turnstile'
import {
  checkUserLoginLock,
  recordUserLoginFailure,
  clearUserLoginFailures,
} from '@/lib/security/user-login-security'
import { verifyPassword, signUserToken, setUserCookie } from '@/lib/user-auth'
import { withService } from '@/lib/db/pg'

type AppUserRow = {
  id: string
  email: string
  password_hash: string | null
  full_name: string | null
  is_active: boolean
  email_verified_at: Date | string | null
  must_change_password: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const turnstile = await verifyTurnstileToken(request, body.turnstileToken, {
      required: process.env.TURNSTILE_ENFORCE_AUTH === 'true',
      action: 'user_login',
    })
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error || '人机验证失败' }, { status: 403 })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) {
      return NextResponse.json({ error: '请输入邮箱和密码' }, { status: 400 })
    }

    const lock = await checkUserLoginLock(request, email)
    if (lock.locked) {
      const minutes = Math.max(1, Math.ceil(lock.retryAfterSeconds / 60))
      return NextResponse.json(
        { error: (lock as { error?: string }).error || `尝试次数过多，请 ${minutes} 分钟后再试` },
        { status: 429, headers: { 'Retry-After': String(lock.retryAfterSeconds || 60) } }
      )
    }

    const rows = await withService(async (tx) => {
      return tx<AppUserRow[]>`
        SELECT id, email, password_hash, full_name, is_active, email_verified_at, must_change_password
        FROM app_users WHERE email = ${email} LIMIT 1
      `
    })
    const user = rows[0]

    const generic401 = async () => {
      await recordUserLoginFailure(request, email)
      return NextResponse.json({ error: '邮箱或密码不正确' }, { status: 401 })
    }

    if (!user) return generic401()

    if (user.password_hash === null) {
      // 存量迁移用户（密码哈希不可从 Supabase Auth 导出），提示走重置流程
      return NextResponse.json(
        { error: '账号已迁移到新认证系统，请先通过「忘记密码」重置密码后再登录' },
        { status: 401 }
      )
    }

    if (!user.is_active) {
      return NextResponse.json({ error: '账号已被停用，请联系客服' }, { status: 403 })
    }

    if (!(await verifyPassword(password, user.password_hash))) {
      return generic401()
    }

    if (!user.email_verified_at) {
      return NextResponse.json(
        { error: '请先完成邮箱验证后再登录' },
        { status: 403, headers: { 'X-Need-Verification': '1' } }
      )
    }

    await clearUserLoginFailures(request, email)
    await withService(async (tx) => {
      await tx`UPDATE app_users SET last_login_at = now() WHERE id = ${user.id}`
    })

    const token = await signUserToken({ id: user.id, email: user.email })
    await setUserCookie(token)

    return NextResponse.json({
      success: true,
      mustChangePassword: Boolean(user.must_change_password),
    })
  } catch (err: unknown) {
    console.error('User login error:', err)
    const message = err instanceof Error ? err.message : '登录失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
