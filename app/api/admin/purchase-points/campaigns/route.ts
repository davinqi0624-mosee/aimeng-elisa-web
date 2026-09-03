import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { PURCHASE_POINT_PRODUCT_TYPES } from '@/lib/purchase-points'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanTextArray(value: unknown) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean)
  return cleanText(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function cleanMultiplier(value: unknown) {
  const multiplier = Number(value)
  return Number.isFinite(multiplier) && multiplier >= 1 ? Number(multiplier.toFixed(2)) : 1
}

function cleanPoints(value: unknown) {
  const points = Number(value)
  return Number.isFinite(points) && points >= 0 ? Math.round(points) : 0
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('purchase_point_campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data || [] })
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const id = cleanText(body.id)
    const name = cleanText(body.name)
    const productTypes = cleanTextArray(body.product_types).filter((type) => PURCHASE_POINT_PRODUCT_TYPES.has(type))
    const productSpecs = cleanTextArray(body.product_specs)

    if (!name) return NextResponse.json({ error: '请填写活动名称' }, { status: 400 })

    const payload = {
      name,
      product_types: productTypes,
      product_specs: productSpecs,
      multiplier: cleanMultiplier(body.multiplier),
      bonus_points: cleanPoints(body.bonus_points),
      starts_at: cleanText(body.starts_at) || null,
      ends_at: cleanText(body.ends_at) || null,
      is_active: body.is_active !== false,
    }

    const supabase = createAdminClient()
    const query = id
      ? supabase.from('purchase_point_campaigns').update(payload).eq('id', id)
      : supabase.from('purchase_point_campaigns').insert(payload)
    const { data, error } = await query.select('*').single()

    if (error) throw new Error(`保存积分活动失败: ${error.message}`)
    return NextResponse.json({ campaign: data })
  } catch (err: unknown) {
    console.error('[admin/purchase-points/campaigns]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '保存失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = cleanText(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: '缺少活动 ID' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('purchase_point_campaigns').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
