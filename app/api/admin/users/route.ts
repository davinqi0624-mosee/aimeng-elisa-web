import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit, checkExportLimit, logExport, maskEmail } from '@/lib/admin/audit'

export async function GET(request: NextRequest) {
  const { admin, error: authError } = await requireSuper(request)
  if (authError) return authError

  const supabase = await createClient()
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

  const { data, error } = await supabase
    .from('profiles')
    .select('*, auth.users!inner(email, created_at, last_sign_in_at, phone)')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = (data || []).map((d: any) => d.id)
  let balances: Record<string, number> = {}
  if (userIds.length > 0) {
    const { data: txData } = await supabase
      .from('point_transactions')
      .select('user_id, amount, type')
      .in('user_id', userIds)

    for (const tx of txData || []) {
      if (!balances[tx.user_id]) balances[tx.user_id] = 0
      if (tx.type === 'earn') balances[tx.user_id] += tx.amount
      if (tx.type === 'spend') balances[tx.user_id] -= tx.amount
    }
  }

  const users = (data || []).map((d: any) => ({
    id: d.id,
    email: d.auth?.users?.email || d.email,
    full_name: d.full_name,
    role: d.role,
    balance: balances[d.id] || 0,
    created_at: d.created_at,
    last_sign_in_at: d.auth?.users?.last_sign_in_at || d.last_sign_in_at,
    phone: d.auth?.users?.phone || d.phone,
  }))

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
    const maskedUsers = users.map((u: any) => ({
      ...u,
      email: maskEmail(u.email),
      phone: u.phone ? u.phone.slice(0, 3) + '****' + u.phone.slice(-4) : '',
    }))

    return NextResponse.json({ users: maskedUsers, exported: true, count: users.length })
  }

  return NextResponse.json({ users })
}
