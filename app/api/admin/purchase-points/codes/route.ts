import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getPurchasePointDefaultPoints, getPurchasePointDefaultSpec, PURCHASE_POINT_PRODUCT_TYPES } from '@/lib/purchase-points'

const CODE_STATUSES = new Set(['active', 'used', 'disabled', 'expired'])

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeCode(value: unknown) {
  return cleanText(value).replace(/\s+/g, '').toUpperCase()
}

function cleanPoints(value: unknown) {
  const points = Number(value)
  return Number.isFinite(points) && points >= 0 ? Math.round(points) : -1
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') || 'active'
  const limit = Math.min(200, Math.max(20, Number(searchParams.get('limit')) || 100))

  let query = supabase
    .from('purchase_point_codes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status !== 'all') {
    if (!CODE_STATUSES.has(status)) {
      return NextResponse.json({ error: '未知积分码状态' }, { status: 400 })
    }
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ codes: data || [] })
}

export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const code = normalizeCode(body.code)
    const bulkCodes = cleanText(body.bulk_codes)
      .split(/\r?\n/)
      .map((item) => normalizeCode(item))
      .filter(Boolean)
    const productType = cleanText(body.product_type)
    const inputProductSpec = cleanText(body.product_spec) || 'default'
    const inputBasePoints = cleanPoints(body.base_points)
    const status = cleanText(body.status) || 'active'
    const expiresAt = cleanText(body.expires_at)

    if (!code && bulkCodes.length === 0) return NextResponse.json({ error: '请填写积分码' }, { status: 400 })
    if (!PURCHASE_POINT_PRODUCT_TYPES.has(productType)) {
      return NextResponse.json({ error: '请选择有效的产品类型' }, { status: 400 })
    }
    if (inputBasePoints < 0) {
      return NextResponse.json({ error: '基础积分必须为 0 或正整数' }, { status: 400 })
    }
    if (!CODE_STATUSES.has(status)) {
      return NextResponse.json({ error: '未知积分码状态' }, { status: 400 })
    }

    const baseRow = {
      product_type: productType,
      product_spec: productType === 'biochemical_reagents' ? getPurchasePointDefaultSpec(productType) : inputProductSpec,
      catalog_number: cleanText(body.catalog_number) || null,
      batch_number: cleanText(body.batch_number) || null,
      base_points: productType === 'biochemical_reagents' ? getPurchasePointDefaultPoints(productType) : inputBasePoints,
      status,
      expires_at: expiresAt || null,
    }
    const rows = (bulkCodes.length > 0 ? Array.from(new Set(bulkCodes)) : [code])
      .map((item) => ({ ...baseRow, code: item }))

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('purchase_point_codes')
      .upsert(rows, { onConflict: 'code' })
      .select('*')

    if (error) throw new Error(`保存积分码失败: ${error.message}`)
    return NextResponse.json({ codes: data || [], count: data?.length || 0 })
  } catch (err: unknown) {
    console.error('[admin/purchase-points/codes]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : '保存失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const { searchParams } = new URL(request.url)
  const id = cleanText(searchParams.get('id'))
  if (!id) return NextResponse.json({ error: '缺少积分码 ID' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: codeRow, error: readError } = await supabase
    .from('purchase_point_codes')
    .select('id, status')
    .eq('id', id)
    .single()
  if (readError || !codeRow) return NextResponse.json({ error: readError?.message || '积分码不存在' }, { status: 404 })
  if (codeRow.status === 'used') {
    return NextResponse.json({ error: '已使用的积分码不能删除，可停用或保留追溯。' }, { status: 400 })
  }

  const { error } = await supabase.from('purchase_point_codes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
