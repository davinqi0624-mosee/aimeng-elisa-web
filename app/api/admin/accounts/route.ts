import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuper, requireAdminSession, hashPassword } from '@/lib/admin/auth'

const ALL_PERMISSIONS = [
  'product_manage',
  'points_review',
  'citation_review',
  'datasheet_generate',
  'order_manage',
  'user_manage',
  'system_settings',
]

// GET: list all admin accounts
export async function GET(request: NextRequest) {
  const { admin, error } = await requireAdminSession(request)
  if (error) return error

  const supabase = await createClient()

  const { data: accounts, error: dbError } = await supabase
    .from('admin_accounts')
    .select('id, username, role, display_name, is_active, created_by, created_at, last_login_at')
    .order('created_at', { ascending: false })

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Fetch creator names
  const creatorIds = [...new Set((accounts || []).map((a: any) => a.created_by).filter(Boolean))]
  let creators: Record<string, string> = {}
  if (creatorIds.length > 0) {
    const { data: creatorData } = await supabase
      .from('admin_accounts')
      .select('id, username')
      .in('id', creatorIds)
    creators = Object.fromEntries((creatorData || []).map((c: any) => [c.id, c.username]))
  }

  // Fetch permissions for each account
  const adminIds = (accounts || []).map((a: any) => a.id)
  let permissionsMap: Record<string, string[]> = {}
  if (adminIds.length > 0) {
    const { data: permData } = await supabase
      .from('admin_permissions')
      .select('admin_id, permission_code')
      .in('admin_id', adminIds)
      .eq('is_allowed', true)
    for (const p of permData || []) {
      if (!permissionsMap[p.admin_id]) permissionsMap[p.admin_id] = []
      permissionsMap[p.admin_id].push(p.permission_code)
    }
  }

  const enriched = (accounts || []).map((a: any) => ({
    ...a,
    created_by_name: creators[a.created_by] || '-',
    permissions: permissionsMap[a.id] || [],
  }))

  return NextResponse.json({ accounts: enriched })
}

// POST: create new admin
export async function POST(request: NextRequest) {
  const { admin: currentAdmin, error } = await requireSuper(request)
  if (error) return error

  try {
    const body = await request.json()
    const { username, password, role, display_name, permissions } = body

    if (!username || !password || !role) {
      return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
    }

    if (role === 'super' && currentAdmin!.role !== 'super') {
      return NextResponse.json({ error: '只有超级管理员能创建超级管理员' }, { status: 403 })
    }

    const supabase = await createClient()
    const passwordHash = await hashPassword(password)

    const { data: newAdmin, error: insertErr } = await supabase
      .from('admin_accounts')
      .insert({
        username,
        password_hash: passwordHash,
        role,
        display_name: display_name || username,
        created_by: currentAdmin!.id,
      })
      .select('id')
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Insert permissions
    if (permissions && permissions.length > 0) {
      const permRows = permissions.map((code: string) => ({
        admin_id: newAdmin.id,
        permission_code: code,
        is_allowed: true,
      }))
      await supabase.from('admin_permissions').insert(permRows)
    }

    return NextResponse.json({ success: true, id: newAdmin.id })
  } catch (err: any) {
    console.error('[admin/accounts POST]', err)
    return NextResponse.json({ error: '创建失败' }, { status: 500 })
  }
}

// PUT: update admin
export async function PUT(request: NextRequest) {
  const { admin: currentAdmin, error } = await requireSuper(request)
  if (error) return error

  try {
    const body = await request.json()
    const { id, display_name, role, is_active, permissions } = body

    if (!id) {
      return NextResponse.json({ error: '缺少管理员ID' }, { status: 400 })
    }

    // Cannot modify self's role to non-super
    if (id === currentAdmin!.id && role && role !== 'super') {
      return NextResponse.json({ error: '不能取消自己的超级管理员权限' }, { status: 403 })
    }

    const supabase = await createClient()

    const updateData: any = {}
    if (display_name !== undefined) updateData.display_name = display_name
    if (role !== undefined) updateData.role = role
    if (is_active !== undefined) updateData.is_active = is_active

    if (Object.keys(updateData).length > 0) {
      const { error: updateErr } = await supabase
        .from('admin_accounts')
        .update(updateData)
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }
    }

    // Update permissions
    if (permissions !== undefined) {
      await supabase.from('admin_permissions').delete().eq('admin_id', id)
      if (permissions.length > 0) {
        const permRows = permissions.map((code: string) => ({
          admin_id: id,
          permission_code: code,
          is_allowed: true,
        }))
        await supabase.from('admin_permissions').insert(permRows)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[admin/accounts PUT]', err)
    return NextResponse.json({ error: '更新失败' }, { status: 500 })
  }
}

// DELETE: delete admin
export async function DELETE(request: NextRequest) {
  const { admin: currentAdmin, error } = await requireSuper(request)
  if (error) return error

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: '缺少管理员ID' }, { status: 400 })
    }

    if (id === currentAdmin!.id) {
      return NextResponse.json({ error: '不能删除自己' }, { status: 403 })
    }

    const supabase = await createClient()

    const { error: deleteErr } = await supabase
      .from('admin_accounts')
      .delete()
      .eq('id', id)

    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[admin/accounts DELETE]', err)
    return NextResponse.json({ error: '删除失败' }, { status: 500 })
  }
}
