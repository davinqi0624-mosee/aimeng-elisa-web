import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const species = searchParams.get('species')?.split(',').filter(Boolean) || []
  const sampleType = searchParams.get('sampleType')
  const query = searchParams.get('query')?.trim()

  const supabase = await createClient()

  let dbQuery = supabase
    .from('products')
    .select('*, product_species(species)', { count: 'exact' })
    .eq('status', 'active')

  // Species filter
  if (species.length > 0) {
    const { data: productIds } = await supabase
      .from('product_species')
      .select('product_id')
      .in('species', species)
    const ids = [...new Set(productIds?.map((r) => r.product_id) || [])]
    if (ids.length > 0) {
      dbQuery = dbQuery.in('id', ids)
    } else {
      dbQuery = dbQuery.eq('id', '00000000-0000-0000-0000-000000000000')
    }
  }

  // Sample type filter
  if (sampleType && sampleType !== '全部') {
    dbQuery = dbQuery.contains('sample_type', [sampleType])
  }

  // Query filter (target/aliases)
  if (query) {
    const { data: aliasMatches } = await supabase
      .from('product_aliases')
      .select('product_id')
      .ilike('alias', `%${query}%`)
    const aliasIds = aliasMatches?.map((r) => r.product_id) || []

    if (aliasIds.length > 0) {
      dbQuery = dbQuery.or(`target.ilike.%${query}%,name.ilike.%${query}%,id.in.(${aliasIds.join(',')})`)
    } else {
      dbQuery = dbQuery.or(`target.ilike.%${query}%,name.ilike.%${query}%`)
    }
  }

  const { data, count, error } = await dbQuery
    .order('is_featured', { ascending: false })
    .range(0, 47)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    products: data || [],
    count: count || 0,
    filters: { species, sampleType, query },
  })
}
