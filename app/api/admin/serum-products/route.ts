import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'

interface QualityItemInput {
  label?: unknown
  value?: unknown
}

interface ComparisonPointInput {
  label?: unknown
  aimeng?: unknown
  common?: unknown
}

interface SerumProductBody {
  id?: unknown
  slug?: unknown
  category?: unknown
  name?: unknown
  english_name?: unknown
  catalog_number?: unknown
  origin?: unknown
  serum_type?: unknown
  package_size?: unknown
  image_url?: unknown
  summary?: unknown
  description?: unknown
  applications?: unknown
  quality_items?: unknown
  cell_applications?: unknown
  comparison_points?: unknown
  status?: unknown
  sort_order?: unknown
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function asTextArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === 'string') return value.split('\n').map((item) => item.trim()).filter(Boolean)
  return []
}

function asQualityItems(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item: QualityItemInput) => ({ label: String(item.label || '').trim(), value: String(item.value || '').trim() }))
      .filter((item) => item.label || item.value)
  }
  return []
}

function asComparisonPoints(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item: ComparisonPointInput) => ({
        label: String(item.label || '').trim(),
        aimeng: String(item.aimeng || '').trim(),
        common: String(item.common || '').trim(),
      }))
      .filter((item) => item.label || item.aimeng || item.common)
  }
  return []
}

function buildPayload(body: SerumProductBody) {
  const name = String(body.name || '').trim()
  const catalogNumber = String(body.catalog_number || '').trim()
  const slug = String(body.slug || '').trim() || slugify(catalogNumber || name)
  const status = String(body.status || '')

  return {
    slug,
    category: body.category === 'animal-serum' ? 'animal-serum' : 'fbs',
    name,
    english_name: String(body.english_name || '').trim(),
    catalog_number: catalogNumber,
    origin: String(body.origin || '').trim(),
    serum_type: String(body.serum_type || '').trim(),
    package_size: String(body.package_size || '').trim(),
    image_url: String(body.image_url || '').trim(),
    summary: String(body.summary || '').trim(),
    description: asTextArray(body.description),
    applications: asTextArray(body.applications),
    quality_items: asQualityItems(body.quality_items),
    cell_applications: asTextArray(body.cell_applications),
    comparison_points: asComparisonPoints(body.comparison_points),
    status: ['active', 'draft', 'archived'].includes(status) ? status : 'active',
    sort_order: Number(body.sort_order) || 0,
  }
}

function isMissingSerumProductsTable(message?: string) {
  return Boolean(message?.includes('serum_products') && (message.includes('schema cache') || message.includes('does not exist')))
}

function setupTableResponse(message?: string) {
  return NextResponse.json(
    {
      error: '数据库还没有创建 serum_products 血清产品表。请先在 Supabase SQL Editor 执行项目里的 supabase/migrations/027_serum_products.sql，然后刷新后台页面。',
      detail: message,
      needsSetup: true,
    },
    { status: 500 }
  )
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, '缺少服务器权限密钥') }, { status: 500 })
  }
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')

  let query = supabase.from('serum_products').select('*').order('sort_order').order('created_at', { ascending: false })
  if (category === 'fbs' || category === 'animal-serum') query = query.eq('category', category)

  const { data, error } = await query
  if (error) {
    if (isMissingSerumProductsTable(error.message)) return setupTableResponse(error.message)
    return NextResponse.json({ error: error.message, needsSetup: error.message.includes('serum_products') }, { status: 500 })
  }

  return NextResponse.json({ products: data || [] })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const supabase = createAdminClient()
    const body = await request.json() as SerumProductBody
    const payload = buildPayload(body)
    if (!payload.name) {
      return NextResponse.json({ error: '请填写产品名称' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('serum_products')
      .insert(payload)
      .select('id')
      .single()
    if (error) throw error

    await logAudit({
      admin_id: admin!.id,
      action: 'create',
      target_table: 'serum_products',
      target_id: data.id,
      new_value: payload,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ id: data.id })
  } catch (err: unknown) {
    const message = errorMessage(err, '创建失败')
    if (isMissingSerumProductsTable(message)) return setupTableResponse(message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const supabase = createAdminClient()
    const body = await request.json() as SerumProductBody
    const id = String(body.id || '')
    if (!id) return NextResponse.json({ error: '缺少产品ID' }, { status: 400 })

    const { data: oldValue } = await supabase.from('serum_products').select('*').eq('id', id).single()
    const payload = buildPayload(body)

    const { error } = await supabase.from('serum_products').update(payload).eq('id', id)
    if (error) throw error

    await logAudit({
      admin_id: admin!.id,
      action: 'update',
      target_table: 'serum_products',
      target_id: id,
      old_value: oldValue,
      new_value: payload,
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = errorMessage(err, '更新失败')
    if (isMissingSerumProductsTable(message)) return setupTableResponse(message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  let supabase
  try {
    supabase = createAdminClient()
  } catch (err: unknown) {
    return NextResponse.json({ error: errorMessage(err, '缺少服务器权限密钥') }, { status: 500 })
  }
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少产品ID' }, { status: 400 })

  const { data: oldValue } = await supabase.from('serum_products').select('*').eq('id', id).single()
  const { error } = await supabase.from('serum_products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    admin_id: admin!.id,
    action: 'delete',
    target_table: 'serum_products',
    target_id: id,
    old_value: oldValue,
    ip_address: getClientIP(request),
  })

  return NextResponse.json({ success: true })
}
