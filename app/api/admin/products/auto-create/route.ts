import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'

const SPECIES_NAME_ZH: Record<string, string> = {
  Human: '人',
  Mouse: '小鼠',
  Rat: '大鼠',
  Rabbit: '兔',
  Monkey: '猴',
  Canine: '犬',
  Dog: '犬',
  Porcine: '猪',
  Pig: '猪',
  Bovine: '牛',
  Cow: '牛',
  Chicken: '鸡',
  Sheep: '羊',
}

const METHOD_LABEL: Record<string, string> = {
  sandwich: '夹心法',
  competitive: '竞争法',
  chemiluminescence: '化学发光法',
}

function extractFromHeader(header: string, key: string): string | null {
  const match = header.match(new RegExp(`${key}[：:]\\s*([^\\n]+)`))
  return match ? match[1].trim() : null
}

function generateSlug(target: string, species: string, method: string, catalogNumber: string): string {
  const base = `${target}-${species}-${method}-${catalogNumber}`
  return base
    .toLowerCase()
    .replace(/[^a-z0-9α-ωΑ-Ω-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()

  try {
    const body = await request.json()
    const { datasheetId, price = 2800, preview = false } = body

    if (!datasheetId) {
      return NextResponse.json({ error: '缺少说明书ID' }, { status: 400 })
    }

    const { data: ds, error: dsError } = await supabase
      .from('auto_datasheets')
      .select('*')
      .eq('id', datasheetId)
      .single()

    if (dsError || !ds) {
      return NextResponse.json({ error: '说明书不存在' }, { status: 404 })
    }

    if (ds.product_id) {
      return NextResponse.json({ error: '该说明书已上架为商品' }, { status: 400 })
    }

    const header = ds.content?.header || ''
    const detectionRange = extractFromHeader(header, '检测范围') || '15.6-1000 pg/ml'
    const sensitivity = extractFromHeader(header, '灵敏度') || '1.0 pg/ml'
    const description = extractFromHeader(header, '简介') || ds.title

    const slug = generateSlug(ds.target, ds.species, ds.method, ds.catalog_number)
    const name = `${ds.target} (${ds.species}) ${METHOD_LABEL[ds.method] || ds.method} ELISA 试剂盒`

    if (preview) {
      return NextResponse.json({
        preview: true,
        name,
        slug,
        target: ds.target,
        species: ds.species,
        method: ds.method,
        catalogNumber: ds.catalog_number,
        detectionRange,
        sensitivity,
        description,
        price,
        size: ds.size,
      })
    }

    const productData = {
      name,
      slug,
      description,
      target: ds.target,
      detection_range: detectionRange,
      sensitivity,
      sample_type: ['血清', '血浆', '细胞培养上清', '组织匀浆'],
      price,
      currency: 'CNY',
      stock_status: 'in_stock',
      status: 'active',
    }

    let product = null
    const { data: firstAttempt, error: firstError } = await supabase
      .from('products')
      .insert(productData)
      .select('id, slug')
      .single()

    if (firstError && (firstError.code === '23505' || firstError.message?.includes('products_slug_key'))) {
      const { data: secondAttempt, error: secondError } = await supabase
        .from('products')
        .insert({ ...productData, slug: `${slug}-${Date.now().toString(36)}` })
        .select('id, slug')
        .single()
      if (secondError) throw secondError
      product = secondAttempt
    } else if (firstError) {
      throw firstError
    } else {
      product = firstAttempt
    }

    await supabase.from('product_species').insert({
      product_id: product.id,
      species: ds.species,
      species_name_zh: SPECIES_NAME_ZH[ds.species] || ds.species,
      is_primary: true,
    })

    await supabase.from('product_aliases').insert({
      product_id: product.id,
      alias: ds.target,
      alias_type: 'target',
      language: 'en',
    })

    await supabase
      .from('auto_datasheets')
      .update({ status: 'published', product_id: product.id })
      .eq('id', datasheetId)

    await logAudit({
      admin_id: admin!.id,
      action: 'create',
      target_table: 'products',
      target_id: product.id,
      new_value: { name, slug: product.slug, datasheetId, price },
      reason: '从说明书一键上架',
      ip_address: getClientIP(request),
    })

    return NextResponse.json({ productId: product.id, slug: product.slug })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || '上架失败' }, { status: 500 })
  }
}
