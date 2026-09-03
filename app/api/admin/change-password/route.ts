import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { clearAdminCookie, hashPassword, requireAdminSession, verifyPassword } from '@/lib/admin/auth'

export async function POST(request: NextRequest) {
  const { admin, error } = await requireAdminSession(request)
  if (error) return error

  try {
    const body = await request.json()
    const currentPassword = String(body.currentPassword || '')
    const newPassword = String(body.newPassword || '')
    const confirmPassword = String(body.confirmPassword || '')

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: '请填写当前密码、新密码和确认密码' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: '新密码至少需要 8 位' }, { status: 400 })
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: '两次输入的新密码不一致' }, { status: 400 })
    }

    if (newPassword === currentPassword) {
      return NextResponse.json({ error: '新密码不能与当前密码相同' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: account, error: dbError } = await supabase
      .from('admin_accounts')
      .select('id, password_hash, is_active')
      .eq('id', admin!.id)
      .single()

    if (dbError || !account) {
      return NextResponse.json({ error: '管理员账号不存在' }, { status: 404 })
    }

    if (!account.is_active) {
      await clearAdminCookie()
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 })
    }

    const valid = await verifyPassword(currentPassword, account.password_hash)
    if (!valid) {
      return NextResponse.json({ error: '当前密码不正确' }, { status: 401 })
    }

    const passwordHash = await hashPassword(newPassword)
    const { error: updateError } = await supabase
      .from('admin_accounts')
      .update({ password_hash: passwordHash })
      .eq('id', admin!.id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    await clearAdminCookie()
    return NextResponse.json({ success: true, message: '密码已修改，请使用新密码重新登录' })
  } catch (err) {
    console.error('[admin/change-password]', err)
    return NextResponse.json({ error: '修改密码失败' }, { status: 500 })
  }
}
