import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireSuper } from '@/lib/admin/auth'
import { generateProductSlug } from '@/lib/products'

export async function POST(request: NextRequest) {
  const { error: authError } = await requireSuper(request)
  if (authError) return authError

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: '缺少 SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    // 1. Find all products with missing slug
    const { data: missingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name, target, catalog_number')
      .or('slug.is.null,slug.eq.')

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!missingProducts || missingProducts.length === 0) {
      return NextResponse.json({ fixed: 0, message: '所有产品都已存在 slug' })
    }

    // 2. Generate slugs and update in batches (avoid upsert because NOT NULL columns cause INSERT to fail)
    let fixed = 0
    const errors: string[] = []
    const batchSize = 50

    for (let i = 0; i < missingProducts.length; i += batchSize) {
      const batch = missingProducts.slice(i, i + batchSize)
      await Promise.all(
        batch.map(async (p) => {
          try {
            const slug = generateProductSlug(
              p.name || `product-${p.id.slice(0, 8)}`,
              p.target || undefined,
              p.catalog_number || undefined
            )
            const { error: updateError } = await supabase
              .from('products')
              .update({ slug })
              .eq('id', p.id)

            if (updateError) {
              errors.push(`${p.id}: ${updateError.message}`)
            } else {
              fixed++
            }
          } catch (err: any) {
            errors.push(`${p.id}: ${err.message}`)
          }
        })
      )
    }

    if (errors.length > 0) {
      console.error('[fix-slugs] Errors:', errors)
    }

    return NextResponse.json({
      fixed,
      total: missingProducts.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined,
      message: `成功修复 ${fixed}/${missingProducts.length} 个缺失 slug 的产品`,
    })
  } catch (err: any) {
    console.error('[fix-slugs] Exception:', err)
    return NextResponse.json({ error: err.message || '修复失败' }, { status: 500 })
  }
}
