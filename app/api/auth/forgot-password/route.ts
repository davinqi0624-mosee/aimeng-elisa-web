import { NextRequest, NextResponse } from 'next/server'
import { verifyTurnstileToken } from '@/lib/security/turnstile'
import { recordUserLoginFailure } from '@/lib/security/user-login-security'
import { withService } from '@/lib/db/pg'
import { createAuthToken, invalidateTokens } from '@/lib/user-auth/tokens'
import { sendPasswordResetEmail, isEmailEnabled } from '@/lib/email'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const turnstile = await verifyTurnstileToken(request, body.turnstileToken, {
      required: process.env.TURNSTILE_ENFORCE_AUTH === 'true',
      action: 'user_forgot_password',
    })
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error || '人机验证失败' }, { status: 403 })
    }

    const email = cleanText(body.email).toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '请输入正确的邮箱' }, { status: 400 })
    }

    if (!isEmailEnabled()) {
      return NextResponse.json({
        success: true,
        message: '当前未启用邮件服务。请联系管理员在后台为您重置密码。',
      })
    }

    const rows = await withService(async (tx) => {
      return tx<{ id: string; full_name: string | null; is_active: boolean }[]>`
        SELECT id, full_name, is_active FROM app_users WHERE email = ${email} LIMIT 1
      `
    })
    const user = rows[0]

    if (user && user.is_active) {
      await invalidateTokens(user.id, 'password_reset')
      const token = await createAuthToken(user.id, 'password_reset')
      const sent = await sendPasswordResetEmail(email, user.full_name || '', token)
      if (!sent.sent) console.error('[forgot-password] send failed', sent.reason)
    } else {
      // 不泄露邮箱是否存在
      await recordUserLoginFailure(request, email)
    }

    return NextResponse.json({
      success: true,
      message: '如果该邮箱已注册，重置邮件已发送，请查收（注意垃圾邮件箱）。',
    })
  } catch (err: unknown) {
    console.error('Forgot password error:', err)
    return NextResponse.json({ error: '请求失败，请稍后重试' }, { status: 500 })
  }
}
