import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTurnstileToken } from '@/lib/security/turnstile'
import { reserveRegistrationAttempt } from '@/lib/security/registration-security'

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

    if (!email) return NextResponse.json({ error: '请输入邮箱' }, { status: 400 })
    if (!password || password.length < 6) return NextResponse.json({ error: '密码至少需要6位字符' }, { status: 400 })
    if (!fullName) return NextResponse.json({ error: '请输入姓名' }, { status: 400 })

    const registration = await reserveRegistrationAttempt(request, email)
    if (!registration.allowed) {
      return NextResponse.json({ error: registration.reason }, {
        status: 429,
        headers: { 'Retry-After': String(registration.retryAfterSeconds) },
      })
    }

    const authAdmin = createAdminClient()
    const { data, error: signUpError } = await authAdmin.auth.signUp({
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
      return NextResponse.json({ error: signUpError.message }, { status: 400 })
    }

    const user = data.user
    if (!user) {
      return NextResponse.json({ error: '注册失败，请稍后重试' }, { status: 500 })
    }
    if (Array.isArray(user.identities) && user.identities.length === 0) {
      return NextResponse.json({ error: '该邮箱已经注册，请直接登录。' }, { status: 400 })
    }

    const dbAdmin = createAdminClient()
    const { error: profileError } = await dbAdmin.from('profiles').upsert({
      id: user.id,
      full_name: fullName,
      role: 'user',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

    if (profileError) throw new Error(`创建用户档案失败: ${profileError.message}`)

    return NextResponse.json({
      success: true,
      message: '注册成功。请查收邮箱并完成验证，验证成功后将发放50积分。',
      bonusPoints: 0,
    })
  } catch (err: unknown) {
    console.error('Register error:', err)
    return NextResponse.json({ error: errorMessage(err, '注册失败') }, { status: 500 })
  }
}
