import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { createAdminClient } from '@/lib/supabase/admin'

type ProductBody = {
  id?: unknown
  catalog_number?: unknown
  indicator_name?: unknown
  specifications?: unknown
  wavelength?: unknown
  price_48t?: unknown
  price_96t?: unknown
  status?: unknown
  sort_order?: unknown
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function number(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function specifications(value: unknown) {
  const values = Array.isArray(value) ? value : [value]
  const normalized = values
    .map((item) => text(item).toUpperCase())
    .filter((item): item is '48T' | '96T' => item === '48T' || item === '96T')
  return Array.from(new Set(normalized.includes('96T') ? normalized : ['96T', ...normalized]))
}

function buildPayload(body: ProductBody) {
  const catalogNumber = text(body.catalog_number).toUpperCase()
  const indicatorName = text(body.indicator_name)
  const selectedSpecifications = specifications(body.specifications)
  const wavelength = text(body.wavelength)
  const price96t = number(body.price_96t)
  const price48t = selectedSpecifications.includes('48T') ? number(body.price_48t) : null
  const rawStatus = text(body.status)

  return {
    catalog_number: catalogNumber,
    indicator_name: indicatorName,
    specifications: selectedSpecifications,
    wavelength,
    price_96t: price96t,
    price_48t: price48t,
    status: ['active', 'draft', 'archived'].includes(rawStatus) ? rawStatus : 'draft',
    sort_order: Math.floor(Number(body.sort_order) || 0),
  }
}

function missingTable(message?: string) {
  if (!message || /column .*?(does not exist|not found in schema cache)/i.test(message)) return false
  return /(?:relation|table).*biochemical_products.*does not exist|biochemical_products.*table.*not found in schema cache/i.test(message)
}

function setupResponse(message?: string) {
  return NextResponse.json({
    error: '数据库尚未创建生化法试剂盒目录，请先执行 supabase/migrations/069_biochemical_products.sql。',
    detail: message,
    needsSetup: true,
  }, { status: 503 })
}

function migrationResponse(message?: string) {
  return NextResponse.json({
    error: '生化产品目录还是旧版结构，请先在 Supabase SQL Editor 执行 supabase/migrations/070_biochemical_product_specifications.sql，再录入双规格和对应价格。',
    detail: message,
    needsMigration: true,
  }, { status: 503 })
}

function validate(payload: ReturnType<typeof buildPayload>) {
  if (!payload.catalog_number) return '请填写货号'
  if (!payload.indicator_name) return '请填写指标名称'
  if (!payload.wavelength) return '请填写操作波长'
  if (payload.price_96t === null) return '请填写96T价格'
  if (payload.specifications.includes('48T') && payload.price_48t === null) return '已选择48T，请填写48T价格'
  return ''
}

function isMissingModernColumns(message?: string) {
  return Boolean(message && /specifications|price_96t|price_48t/i.test(message) && /schema cache|column .* does not exist/i.test(message))
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const supabase = createAdminClient()
    const search = text(new URL(request.url).searchParams.get('q'))
    let query = supabase
      .from('biochemical_products')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`catalog_number.ilike.%${search}%,indicator_name.ilike.%${search}%,wavelength.ilike.%${search}%`)
    }

    const { data, error } = await query
    if (error) {
      if (missingTable(error.message)) return setupResponse(error.message)
      if (isMissingModernColumns(error.message)) {
        let legacyQuery = supabase
          .from('biochemical_products')
          .select('id, catalog_number, indicator_name, specification, wavelength, price, status, sort_order, created_at')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false })

        if (search) {
          legacyQuery = legacyQuery.or(`catalog_number.ilike.%${search}%,indicator_name.ilike.%${search}%,wavelength.ilike.%${search}%`)
        }

        const legacyResult = await legacyQuery
        if (legacyResult.error) throw legacyResult.error
        return NextResponse.json({
          products: (legacyResult.data || []).map((product) => ({
            ...product,
            specifications: [String(product.specification || '96T').toUpperCase() === '48T' ? '48T' : '96T'],
            price_48t: String(product.specification || '').toUpperCase() === '48T' ? product.price : null,
            price_96t: product.price,
          })),
          needsMigration: true,
        })
      }
      throw error
    }
    return NextResponse.json({ products: data || [] })
  } catch (error) {
    const message = error instanceof Error ? error.message : '读取生化产品失败'
    if (missingTable(message)) return setupResponse(message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json() as ProductBody
    const payload = buildPayload(body)
    const validationError = validate(payload)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const supabase = createAdminClient()
    const { data, error } = await supabase.from('biochemical_products').insert(payload).select('id').single()
    if (error && isMissingModernColumns(error.message)) {
      return migrationResponse(error.message)
    }
    if (error) {
      if (missingTable(error.message)) return setupResponse(error.message)
      if (/duplicate key|unique constraint/i.test(error.message)) return NextResponse.json({ error: '该货号已经存在，请直接编辑原产品。' }, { status: 409 })
      throw error
    }
    if (!data) throw new Error('创建生化产品后未返回产品ID')

    await logAudit({ admin_id: admin!.id, action: 'create', target_table: 'biochemical_products', target_id: data.id, new_value: payload, ip_address: getClientIP(request) })
    return NextResponse.json({ id: data.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : '创建生化产品失败'
    if (missingTable(message)) return setupResponse(message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const body = await request.json() as ProductBody
    const id = text(body.id)
    if (!id) return NextResponse.json({ error: '缺少产品ID' }, { status: 400 })
    const payload = buildPayload(body)
    const validationError = validate(payload)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

    const supabase = createAdminClient()
    const { data: oldValue } = await supabase.from('biochemical_products').select('*').eq('id', id).single()
    const { error } = await supabase.from('biochemical_products').update(payload).eq('id', id)
    if (error && isMissingModernColumns(error.message)) {
      return migrationResponse(error.message)
    }
    if (error) {
      if (missingTable(error.message)) return setupResponse(error.message)
      if (/duplicate key|unique constraint/i.test(error.message)) return NextResponse.json({ error: '该货号已经被其他生化产品使用。' }, { status: 409 })
      throw error
    }

    await logAudit({ admin_id: admin!.id, action: 'update', target_table: 'biochemical_products', target_id: id, old_value: oldValue, new_value: payload, ip_address: getClientIP(request) })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : '更新生化产品失败'
    if (missingTable(message)) return setupResponse(message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  try {
    const id = text(new URL(request.url).searchParams.get('id'))
    if (!id) return NextResponse.json({ error: '缺少产品ID' }, { status: 400 })
    const supabase = createAdminClient()
    const { data: oldValue } = await supabase.from('biochemical_products').select('*').eq('id', id).single()
    const { error } = await supabase.from('biochemical_products').update({ status: 'archived' }).eq('id', id)
    if (error) {
      if (missingTable(error.message)) return setupResponse(error.message)
      throw error
    }
    await logAudit({ admin_id: admin!.id, action: 'archive', target_table: 'biochemical_products', target_id: id, old_value: oldValue, new_value: { status: 'archived' }, ip_address: getClientIP(request) })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : '归档生化产品失败'
    if (missingTable(message)) return setupResponse(message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
