import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

function agentPayload(body: Record<string, unknown>) {
  return {
    province: cleanText(body.province),
    province_code: cleanText(body.province_code) || null,
    city: cleanText(body.city) || null,
    company_name: cleanText(body.company_name),
    contact_name: cleanText(body.contact_name) || null,
    phone: cleanText(body.phone) || null,
    email: cleanText(body.email) || null,
    wechat_qr: cleanText(body.wechat_qr || body.wechat_qr_code) || null,
    address: cleanText(body.address) || null,
    is_active: body.is_active !== false,
    sort_order: Number(body.sort_order) || 0,
  }
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const province = searchParams.get('province')
  const status = searchParams.get('status') || 'all'

  let query = supabase
    .from('agents')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (province) query = query.eq('province', province)
  if (status === 'active') query = query.eq('is_active', true)
  if (status === 'inactive') query = query.eq('is_active', false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const agents = (data || []).map((agent: Record<string, unknown>) => ({
    ...agent,
    wechat_qr: agent.wechat_qr || agent.wechat_qr_code,
  }))
  return NextResponse.json({ agents })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const payload = agentPayload(body)
    if (!payload.province || !payload.company_name) {
      return NextResponse.json({ error: '缺少必填字段（省份、单位名称）' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('agents')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw error

    await logAudit({
      admin_id: admin!.id,
      action: 'create',
      target_table: 'agents',
      target_id: data.id,
      new_value: payload,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ id: data.id, message: '代理商创建成功' })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, '创建失败') }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const id = cleanText(body.id)
    if (!id) return NextResponse.json({ error: '缺少代理商ID' }, { status: 400 })

    const payload = agentPayload(body)
    if (!payload.province || !payload.company_name) {
      return NextResponse.json({ error: '缺少必填字段（省份、单位名称）' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: oldAgent } = await supabase.from('agents').select('*').eq('id', id).single()
    const { error } = await supabase.from('agents').update(payload).eq('id', id)
    if (error) throw error

    await logAudit({
      admin_id: admin!.id,
      action: 'update',
      target_table: 'agents',
      target_id: id,
      old_value: oldAgent,
      new_value: payload,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, '更新失败') }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少代理商ID' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: oldAgent } = await supabase.from('agents').select('*').eq('id', id).single()
  const { error } = await supabase.from('agents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
