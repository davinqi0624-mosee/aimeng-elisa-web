import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildExactProductSearchValues, buildProductSearchOrConditions, compactSearchTerm, normalizeSearchTerm, parseProductSearchIntent } from '@/lib/products/search'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const query = normalizeSearchTerm(searchParams.get('query') || '')

  if (!query || query.length < 2) {
    return NextResponse.json({ products: [] })
  }

  try {
    const intent = parseProductSearchIntent(query)
    const searchTerm = intent.catalogLike ? intent.catalogQuery : intent.targetQuery

    if (searchTerm) {
      const exactValues = buildExactProductSearchValues(searchTerm)
      let exactQuery = supabase
        .from('products')
        .select('id, cat_no, catalog_number, name, species, target')
        .eq('status', 'active')
        .limit(5)

      if (intent.speciesQueryValues.length > 0) {
        exactQuery = exactQuery.in('species', intent.speciesQueryValues)
      }

      if (intent.catalogLike) {
        exactQuery = exactQuery.or(`cat_no.in.(${exactValues.join(',')}),catalog_number.in.(${exactValues.join(',')})`)
      } else {
        exactQuery = exactQuery.in('target', exactValues)
      }

      const { data: exactData, error: exactError } = await exactQuery
      if (!exactError && exactData && exactData.length > 0) {
        return NextResponse.json({ products: exactData })
      }
    }

    let dbQuery = supabase
      .from('products')
      .select('id, cat_no, catalog_number, name, species, target')
      .eq('status', 'active')
      .limit(5)

    if (intent.speciesQueryValues.length > 0) {
      dbQuery = dbQuery.in('species', intent.speciesQueryValues)
    }

    const compactQuery = compactSearchTerm(searchTerm).toUpperCase()
    if (compactQuery.startsWith('LV')) {
      // Exact catalog number match
      dbQuery = dbQuery.or(buildProductSearchOrConditions(searchTerm, ['cat_no', 'catalog_number']).join(','))
    } else {
      // Generic fuzzy match across name, target, cat_no
      dbQuery = dbQuery.or(buildProductSearchOrConditions(searchTerm).join(','))
    }

    const { data, error } = await dbQuery

    if (error) throw error

    return NextResponse.json({ products: data || [] })
  } catch (err: unknown) {
    console.error('[products/match]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message || '查询失败' : '查询失败' }, { status: 500 })
  }
}
