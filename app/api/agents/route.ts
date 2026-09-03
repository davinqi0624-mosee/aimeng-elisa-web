import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { SHORT_PUBLIC_CACHE_HEADERS, getMemoryCached } from '@/lib/server/memory-cache'

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

// GET: 公开接口，查询代理商列表
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const province = searchParams.get('province')
  const isActive = searchParams.get('is_active')
  const cacheKey = `api:agents:${province || ''}:${isActive ?? 'default'}`

  try {
    const cached = await getMemoryCached(cacheKey, 60 * 1000, async () => {
      const supabase = await createClient()
      let query = supabase
        .from('agents')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })

      if (province) {
        query = query.eq('province', province)
      }
      query = query.eq('is_active', isActive === null ? true : isActive === 'true')

      const { data, error: dbError } = await query
      if (dbError) throw new Error(dbError.message)
      // Prefer `wechat_qr` (migration 021), fall back to `wechat_qr_code` (legacy)
      const agents = (data || []).map((a: Record<string, unknown>) => ({
        ...a,
        wechat_qr: a.wechat_qr || a.wechat_qr_code,
      }))
      return { agents }
    })

    return NextResponse.json(cached.value, {
      headers: {
        ...SHORT_PUBLIC_CACHE_HEADERS,
        'X-Aimeng-Cache': cached.hit ? 'hit' : 'miss',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '代理商读取失败' }, { status: 500 })
  }
}

// POST: 管理员新增代理商
export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const {
      province,
      province_code,
      city,
      company_name,
      contact_name,
      phone,
      email,
      wechat_qr_code,
      wechat_qr,
      address,
      is_active = true,
      sort_order = 0,
    } = body

    if (!province || !company_name) {
      return NextResponse.json(
        { error: '缺少必填字段（省份、单位名称）' },
        { status: 400 }
      )
    }

    const { data, error: dbError } = await supabase
      .from('agents')
      .insert({
        province,
        province_code,
        city,
        company_name,
        contact_name,
        phone,
        email,
        wechat_qr: wechat_qr || wechat_qr_code,
        address,
        is_active,
        sort_order,
      })
      .select('id')
      .single()

    if (dbError) throw dbError

    await logAudit({
      admin_id: admin!.id,
      action: 'create',
      target_table: 'agents',
      target_id: data.id,
      new_value: { province, company_name, contact_name },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ id: data.id, message: '代理商创建成功' })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: errorMessage(err, '创建失败') },
      { status: 500 }
    )
  }
}

// PUT: 管理员更新代理商
export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  try {
    const body = await request.json()
    const { id, wechat_qr, wechat_qr_code, ...rest } = body
    if (!id) {
      return NextResponse.json(
        { error: '缺少代理商ID' },
        { status: 400 }
      )
    }

    const updates: Record<string, unknown> = { ...rest }
    if (wechat_qr !== undefined) updates.wechat_qr = wechat_qr
    if (wechat_qr_code !== undefined) updates.wechat_qr = wechat_qr_code

    const { data: oldAgent } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    const { error: dbError } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
    if (dbError) throw dbError

    await logAudit({
      admin_id: admin!.id,
      action: 'update',
      target_table: 'agents',
      target_id: id,
      old_value: oldAgent,
      new_value: updates,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: errorMessage(err, '更新失败') },
      { status: 500 }
    )
  }
}

// DELETE: 管理员删除代理商
export async function DELETE(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) {
    return NextResponse.json(
      { error: '缺少代理商ID' },
      { status: 400 }
    )
  }

  const { data: oldAgent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', id)
    .single()

  const { error: dbError } = await supabase
    .from('agents')
    .delete()
    .eq('id', id)
  if (dbError) {
    return NextResponse.json(
      { error: dbError.message },
      { status: 500 }
    )
  }

  await logAudit({
    admin_id: admin!.id,
    action: 'delete',
    target_table: 'agents',
    target_id: id,
    old_value: oldAgent,
    ip_address: getClientIP(request),
  })

  return NextResponse.json({ success: true })
}
