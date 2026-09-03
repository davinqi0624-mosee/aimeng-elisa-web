import { NextResponse } from 'next/server'
import { getCurrentAdmin } from '@/lib/admin/auth'

export async function GET() {
  try {
    const admin = await getCurrentAdmin()
    if (!admin) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    return NextResponse.json(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        display_name: admin.display_name,
        permissions: admin.permissions,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    )
  } catch (err: unknown) {
    console.error('[admin/me]', err)
    return NextResponse.json({ error: '获取信息失败' }, { status: 500 })
  }
}
