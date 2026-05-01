import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentAdmin } from '@/lib/admin/auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const supabase = await createClient()

    // Fetch permissions
    const { data: perms } = await supabase
      .from('admin_permissions')
      .select('permission_code, is_allowed')
      .eq('admin_id', admin.id)

    return NextResponse.json({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      display_name: admin.display_name,
      permissions: (perms || [])
        .filter((p: any) => p.is_allowed)
        .map((p: any) => p.permission_code),
    })
  } catch (err: any) {
    console.error('[admin/me]', err)
    return NextResponse.json({ error: '获取信息失败' }, { status: 500 })
  }
}
