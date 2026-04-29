import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')?.trim() || ''

  if (!query || query.length < 2) {
    return NextResponse.json({ products: [] })
  }

  try {
    let dbQuery = supabase
      .from('products')
      .select('id, cat_no, name, species, target')
      .limit(5)

    if (query.toUpperCase().startsWith('LV')) {
      // Exact catalog number match
      dbQuery = dbQuery.ilike('cat_no', `%${query}%`)
    } else if (query.includes(' ')) {
      // Species + target fuzzy match
      const parts = query.split(/\s+/).filter(Boolean)
      const species = parts[0]
      const target = parts.slice(1).join(' ')

      dbQuery = dbQuery
        .or(`species.ilike.%${species}%,name.ilike.%${species}%`)
        .or(`target.ilike.%${target}%,name.ilike.%${target}%`)
    } else {
      // Generic fuzzy match across name, target, cat_no
      dbQuery = dbQuery.or(`name.ilike.%${query}%,target.ilike.%${query}%,cat_no.ilike.%${query}%`)
    }

    const { data, error } = await dbQuery

    if (error) throw error

    return NextResponse.json({ products: data || [] })
  } catch (err: any) {
    console.error('[products/match]', err)
    return NextResponse.json({ error: err.message || '查询失败' }, { status: 500 })
  }
}
