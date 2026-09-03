import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPassword, signAdminToken, setAdminCookie } from '@/lib/admin/auth'
import { verifyTurnstileToken } from '@/lib/security/turnstile'
import { checkAdminLoginLock, clearAdminLoginFailures, recordAdminLoginFailure } from '@/lib/security/admin-login-security'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password, turnstileToken } = body

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 })
    }

    const lock = await checkAdminLoginLock(request, String(username))
    if (lock.error) return NextResponse.json({ error: lock.error }, { status: 503 })
    if (lock.locked) {
      return NextResponse.json({ error: `登录失败次数过多，请 ${Math.ceil(lock.retryAfterSeconds / 60)} 分钟后重试` }, { status: 429, headers: { 'Retry-After': String(lock.retryAfterSeconds) } })
    }

    const turnstile = await verifyTurnstileToken(request, turnstileToken, {
      required: process.env.TURNSTILE_ENFORCE_AUTH === 'true',
      action: 'admin_login',
    })
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error || '人机验证失败' }, { status: 403 })
    }

    // 安全修复：管理员表查询改用 service-role 客户端（服务端私有），
    // 使数据库可移除面向 anon 的 admin_accounts 读取策略，密码哈希不再暴露给公网 API
    const supabase = createAdminClient()

    const { data: account } = await supabase
      .from('admin_accounts')
      .select('id, username, password_hash, role, display_name, is_active')
      .eq('username', username)
      .single()

    if (!account) {
      const failure = await recordAdminLoginFailure(request, String(username))
      if (failure.retryAfterSeconds > 0) {
        return NextResponse.json({ error: `登录失败次数过多，请 ${Math.ceil(failure.retryAfterSeconds / 60)} 分钟后重试` }, { status: 429, headers: { 'Retry-After': String(failure.retryAfterSeconds) } })
      }
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    if (!account.is_active) {
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 })
    }

    const valid = await verifyPassword(password, account.password_hash)
    if (!valid) {
      const failure = await recordAdminLoginFailure(request, String(username))
      if (failure.retryAfterSeconds > 0) {
        return NextResponse.json({ error: `登录失败次数过多，请 ${Math.ceil(failure.retryAfterSeconds / 60)} 分钟后重试` }, { status: 429, headers: { 'Retry-After': String(failure.retryAfterSeconds) } })
      }
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    await clearAdminLoginFailures(request, String(username))

    // Update last login
    await supabase
      .from('admin_accounts')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', account.id)

    const token = await signAdminToken({
      id: account.id,
      username: account.username,
      role: account.role as 'super' | 'admin',
      display_name: account.display_name || account.username,
      permissions: [],
    })

    await setAdminCookie(token)

    return NextResponse.json({
      success: true,
      role: account.role,
      display_name: account.display_name || account.username,
    })
  } catch (err: unknown) {
    console.error('[admin/login]', err)
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}
