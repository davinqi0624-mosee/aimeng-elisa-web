import { NextRequest, NextResponse } from 'next/server'
import { requireAdminPermission } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit, checkExportLimit, logExport, maskEmail } from '@/lib/admin/audit'
import { withService } from '@/lib/db/pg'

interface AppUserRow {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  email_verified_at: Date | string | null
  is_active: boolean
  must_change_password: boolean
  created_at: Date | string
  last_login_at: Date | string | null
  profile_role: string | null
  balance: number | string | null
}

function toIso(value: Date | string | null): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export async function GET(request: NextRequest) {
  const { admin, error: authError } = await requireAdminPermission(request, 'user_manage')
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50') || 50, 200)
  const offset = Math.max(parseInt(searchParams.get('offset') || '0') || 0, 0)
  const exportCsv = searchParams.get('export') === 'true'

  if (exportCsv) {
    const limitCheck = await checkExportLimit(admin!.id, 1, 3)
    if (!limitCheck.allowed) {
      return NextResponse.json({ error: limitCheck.message }, { status: 429 })
    }
  }

  try {
    const rows = await withService(async (tx) => {
      return tx<AppUserRow[]>`
        SELECT u.id, u.email, u.full_name, u.phone, u.email_verified_at, u.is_active,
               u.must_change_password, u.created_at, u.last_login_at,
               p.role AS profile_role,
               COALESCE(pt.balance, 0) AS balance
        FROM app_users u
        LEFT JOIN profiles p ON p.id = u.id
        LEFT JOIN user_points pt ON pt.user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
    })

    const users = rows.map((row) => ({
      id: row.id,
      email: row.email || '',
      full_name: row.full_name,
      role: row.profile_role || 'user',
      balance: Number(row.balance || 0),
      created_at: toIso(row.created_at) || new Date().toISOString(),
      last_sign_in_at: toIso(row.last_login_at),
      phone: row.phone || '',
      is_active: row.is_active,
      email_verified: Boolean(row.email_verified_at),
      must_change_password: row.must_change_password,
      has_password: true,
    }))

    if (exportCsv) {
      await logExport(admin!.id, 'users', users.length)
      await logAudit({
        admin_id: admin!.id,
        action: 'export',
        target_table: 'app_users',
        new_value: { count: users.length, type: 'users_csv' },
        ip_address: getClientIP(request),
      })

      const maskedUsers = users.map((u) => ({
        ...u,
        email: u.email ? maskEmail(u.email) : '',
        phone: u.phone ? u.phone.slice(0, 3) + '****' + u.phone.slice(-4) : '',
      }))

      return NextResponse.json({ users: maskedUsers, exported: true, count: users.length })
    }

    return NextResponse.json({ users })
  } catch (error) {
    console.error('[admin/users GET]', error)
    return NextResponse.json({ error: '用户读取失败' }, { status: 500 })
  }
}
