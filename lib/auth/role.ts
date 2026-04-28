import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export type UserRole = 'user' | 'admin_l2' | 'admin_l1'

export async function getCurrentUserRole(): Promise<UserRole> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'user'

  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (data?.role as UserRole) || 'user'
}

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: '未登录' }, { status: 401 }), user: null }
  }
  return { error: null, user }
}

export async function requireAdminL2(request: NextRequest) {
  const { error, user } = await requireAuth()
  if (error) return { error, user: null }

  const role = await getCurrentUserRole()
  if (role !== 'admin_l1' && role !== 'admin_l2') {
    return {
      error: NextResponse.json({ error: '无权操作，需要管理员权限 (L2+)' }, { status: 403 }),
      user: null,
    }
  }
  return { error: null, user }
}

export async function requireAdminL1(request: NextRequest) {
  const { error, user } = await requireAuth()
  if (error) return { error, user: null }

  const role = await getCurrentUserRole()
  if (role !== 'admin_l1') {
    return {
      error: NextResponse.json({ error: '无权操作，需要超级管理员权限 (L1)' }, { status: 403 }),
      user: null,
    }
  }
  return { error: null, user }
}
