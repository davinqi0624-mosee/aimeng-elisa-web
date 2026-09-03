import { NextRequest, NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit, checkExportLimit, logExport, maskEmail } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'

interface ProfileRow {
  id: string
  full_name?: string | null
  role?: string | null
  created_at?: string | null
}

interface PointTransactionRow {
  user_id: string
  amount: number
  type: string
}

export async function GET(request: NextRequest) {
  const { admin, error: authError } = await requireAdminPermission(request, 'user_manage')
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')
  const exportCsv = searchParams.get('export') === 'true'

  if (exportCsv) {
    // 检查导出频率限制
    const limitCheck = await checkExportLimit(admin!.id, 1, 3)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.message }, { status: 429 })
    }
  }

  const page = Math.floor(offset / limit) + 1
  const { data: authUsersData, error } = await supabase.auth.admin.listUsers({
    page,
    perPage: limit,
  })

  if (error) {
    return NextResponse.json({ error: error.message || '用户读取失败' }, { status: 500 })
  }

  const authUsers = authUsersData?.users || []
  const userIds = authUsers.map((user) => user.id)
  const profilesById = new Map<string, ProfileRow>()

  if (userIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('id, full_name, role, created_at')
      .in('id', userIds)

    if (profileError) {
      return NextResponse.json({ error: profileError.message || '用户档案读取失败' }, { status: 500 })
    }

    for (const profile of (profileData || []) as ProfileRow[]) {
      profilesById.set(profile.id, profile)
    }
  }

  const balances: Record<string, number> = {}
  if (userIds.length > 0) {
    const { data: txData } = await supabase
      .from('point_transactions')
      .select('user_id, amount, type')
      .in('user_id', userIds)

    for (const tx of (txData || []) as PointTransactionRow[]) {
      if (!balances[tx.user_id]) balances[tx.user_id] = 0
      if (tx.type === 'earn' || tx.type === 'refund') balances[tx.user_id] += tx.amount
      if (tx.type === 'spend') balances[tx.user_id] -= tx.amount
    }
  }

  const users = authUsers.map((authUser) => {
    const profile = profilesById.get(authUser.id)
    return {
      id: authUser.id,
      email: authUser.email || '',
      full_name:
        profile?.full_name ||
        (typeof authUser.user_metadata?.full_name === 'string' ? authUser.user_metadata.full_name : null),
      role: profile?.role || 'user',
      balance: balances[authUser.id] || 0,
      created_at: authUser.created_at || profile?.created_at || new Date().toISOString(),
      last_sign_in_at: authUser.last_sign_in_at || null,
      phone: authUser.phone || '',
    }
  })

  if (exportCsv) {
    await logExport(admin!.id, 'users', users.length)
    await logAudit({
      admin_id: admin!.id,
      action: 'export',
      target_table: 'profiles',
      new_value: { count: users.length, type: 'users_csv' },
      ip_address: getClientIP(request),
    })

    // 脱敏处理
    const maskedUsers = users.map((u) => ({
      ...u,
      email: u.email ? maskEmail(u.email) : '',
      phone: u.phone ? u.phone.slice(0, 3) + '****' + u.phone.slice(-4) : '',
    }))

    return NextResponse.json({ users: maskedUsers, exported: true, count: users.length })
  }

  return NextResponse.json({ users })
}
