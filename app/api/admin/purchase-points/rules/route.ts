import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getPurchasePointDefaultPoints, getPurchasePointDefaultSpec, PURCHASE_POINT_PRODUCT_TYPES } from '@/lib/purchase-points'

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanPoints(value: unknown) {
  const points = Number(value)
  return Number.isFinite(points) && points >= 0 ? Math.round(points) : -1
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('purchase_point_rules')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data || [] })
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const productType = cleanText(body.product_type)
    const inputProductSpec = cleanText(body.product_spec) || 'default'
    const inputPoints = cleanPoints(body.points)
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Math.round(Number(body.sort_order)) : 0

    if (!PURCHASE_POINT_PRODUCT_TYPES.has(productType)) {
      return NextResponse.json({ error: '请选择有效的产品类型' }, { status: 400 })
    }
    if (inputPoints < 0) {
      return NextResponse.json({ error: '积分规则必须为 0 或正整数' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('purchase_point_rules')
      .upsert({
        product_type: productType,
        product_spec: productType === 'biochemical_reagents' ? getPurchasePointDefaultSpec(productType) : inputProductSpec,
        points: productType === 'biochemical_reagents' ? getPurchasePointDefaultPoints(productType) : inputPoints,
        sort_order: sortOrder,
        is_active: body.is_active !== false,
      }, { onConflict: 'product_type,product_spec' })
      .select('*')
      .single()

    if (error) throw new Error(`保存积分规则失败: ${error.message}`)
    return NextResponse.json({ rule: data })
  } catch (err: unknown) {
    console.error('[admin/purchase-points/rules]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '保存失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = cleanText(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: '缺少规则 ID' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('purchase_point_rules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
