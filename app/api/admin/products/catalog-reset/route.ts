import { NextRequest, NextResponse } from 'next/server'
import { requireSuper } from '@/lib/admin/auth'
import { createAdminClient } from '@/lib/supabase/admin'

type ResetAction = 'preview' | 'archive'

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

async function countRows(supabase: ReturnType<typeof createAdminClient>, table: string, build?: (query: any) => any) {
  let query = supabase.from(table).select('id', { count: 'exact', head: true })
  if (build) query = build(query)
  const { count, error } = await query
  if (error) return { count: 0, error: error.message }
  return { count: count || 0, error: '' }
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()
  const [activeProducts, archivedProducts, productImages, activeDocuments] = await Promise.all([
    countRows(supabase, 'products', (query) => query.eq('status', 'active')),
    countRows(supabase, 'products', (query) => query.eq('status', 'archived')),
    countRows(supabase, 'product_images'),
    countRows(supabase, 'product_documents', (query) => query.eq('status', 'active')),
  ])

  const errors = [activeProducts, archivedProducts, productImages, activeDocuments]
    .map((item) => item.error)
    .filter(Boolean)

  return NextResponse.json({
    summary: {
      active_products: activeProducts.count,
      archived_products: archivedProducts.count,
      product_images: productImages.count,
      active_documents: activeDocuments.count,
    },
    errors,
  })
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireSuper(request)
  if (authError) return authError

  const body = (await request.json().catch(() => ({}))) as { action?: ResetAction; confirm_text?: string }
  const action = clean(body.action) as ResetAction
  const confirmText = clean(body.confirm_text)

  if (action !== 'archive') {
    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  }
  if (confirmText !== '归档旧产品目录') {
    return NextResponse.json({ error: '确认文字不正确，请输入：归档旧产品目录' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const archiveToken = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, slug, catalog_number, cat_no, name')
    .eq('status', 'active')
    .limit(20000)

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  const rows = products || []
  let updated = 0
  let failed = 0
  for (const product of rows) {
    const suffix = `${archiveToken}-${String(updated + failed + 1).padStart(5, '0')}`
    const { error } = await supabase
      .from('products')
      .update({
        status: 'archived',
        slug: product.slug ? `${product.slug}--archived-${suffix}` : null,
        catalog_number: product.catalog_number ? `${product.catalog_number}__ARCHIVED_${suffix}` : null,
        cat_no: product.cat_no ? `${product.cat_no}__ARCHIVED_${suffix}` : null,
      })
      .eq('id', product.id)

    if (error) failed += 1
    else updated += 1
  }

  return NextResponse.json({
    message: `旧产品目录已归档 ${updated} 条，失败 ${failed} 条。旧货号已释放，可重新批量导入。`,
    updated,
    failed,
    archived_by: admin?.id || null,
  })
}
