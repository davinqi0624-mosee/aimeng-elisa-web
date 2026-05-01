import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPassword, signAdminToken, setAdminCookie } from '@/lib/admin/auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: account } = await supabase
      .from('admin_accounts')
      .select('id, username, password_hash, role, display_name, is_active')
      .eq('username', username)
      .single()

    if (!account) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

    if (!account.is_active) {
      return NextResponse.json({ error: '账号已被禁用' }, { status: 403 })
    }

    const valid = await verifyPassword(password, account.password_hash)
    if (!valid) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 })
    }

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
    })

    await setAdminCookie(token)

    return NextResponse.json({
      success: true,
      role: account.role,
      display_name: account.display_name || account.username,
    })
  } catch (err: any) {
    console.error('[admin/login]', err)
    return NextResponse.json({ error: '登录失败' }, { status: 500 })
  }
}
