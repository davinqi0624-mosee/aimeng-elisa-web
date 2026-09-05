import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTurnstileToken } from '@/lib/security/turnstile'
import { reserveRegistrationAttempt } from '@/lib/security/registration-security'
import { withService } from '@/lib/db/pg'
import { hashPassword, signUserToken, setUserCookie } from '@/lib/user-auth'
import { createAuthToken } from '@/lib/user-auth/tokens'
import { sendVerificationEmail, isEmailEnabled } from '@/lib/email'
import { awardRegistrationBonus } from '@/lib/points/registration-bonus'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const turnstile = await verifyTurnstileToken(request, body.turnstileToken, {
      required: process.env.TURNSTILE_ENFORCE_AUTH === 'true',
      action: 'user_register',
    })
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error || '人机验证失败' }, { status: 403 })
    }

    const email = cleanText(body.email).toLowerCase()
    const password = cleanText(body.password)
    const fullName = cleanText(body.fullName)
    const organization = cleanText(body.organization)
    const phone = cleanText(body.phone)

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '请输入正确的邮箱' }, { status: 400 })
    }
    if (!password || password.length < 6) return NextResponse.json({ error: '密码至少需要6位字符' }, { status: 400 })
    if (!fullName) return NextResponse.json({ error: '请输入姓名' }, { status: 400 })

    const registration = await reserveRegistrationAttempt(request, email)
    if (!registration.allowed) {
      return NextResponse.json({ error: registration.reason }, {
        status: 429,
        headers: { 'Retry-After': String(registration.retryAfterSeconds) },
      })
    }

    const passwordHash = await hashPassword(password)

    let userId: string
    try {
      const rows = await withService(async (tx) => {
        return tx<{ id: string }[]>`
          INSERT INTO app_users (email, password_hash, full_name, organization, phone)
          VALUES (${email}, ${passwordHash}, ${fullName}, ${organization || null}, ${phone || null})
          RETURNING id
        `
      })
      userId = rows[0].id
    } catch (err) {
      if (err instanceof Error && /duplicate key|unique constraint/i.test(err.message)) {
        return NextResponse.json({ error: '该邮箱已经注册，请直接登录。' }, { status: 400 })
      }
      throw err
    }

    const admin = createAdminClient()
    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      full_name: fullName,
      role: 'user',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (profileError) throw new Error(`创建用户档案失败: ${profileError.message}`)

    if (isEmailEnabled()) {
      const token = await createAuthToken(userId, 'email_verify')
      const sent = await sendVerificationEmail(email, fullName, token)
      if (sent.sent) {
        return NextResponse.json({
          success: true,
          message: '注册成功。请查收邮箱并完成验证，验证成功后将发放50积分。',
          bonusPoints: 0,
        })
      }
      console.error('[register] verification email failed, falling back to auto-verify', sent.reason)
    }

    // 无邮件模式（或发送失败兜底）：立即验证 + 自动登录 + 直接发放 50 积分
    await withService(async (tx) => {
      await tx`UPDATE app_users SET email_verified_at = now() WHERE id = ${userId}`
    })
    await awardRegistrationBonus(admin, userId)

    const token = await signUserToken({ id: userId, email })
    await setUserCookie(token)

    return NextResponse.json({
      success: true,
      message: '注册成功，已自动登录并发放50积分。',
      bonusPoints: 50,
    })
  } catch (err: unknown) {
    console.error('Register error:', err)
    return NextResponse.json({ error: errorMessage(err, '注册失败') }, { status: 500 })
  }
}
