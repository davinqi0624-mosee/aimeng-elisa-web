import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)

  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const sort = searchParams.get('sort') || 'newest'
  const journal = searchParams.get('journal') || ''
  const productCatNo = searchParams.get('product') || ''

  const offset = (page - 1) * limit

  let query = supabase
    .from('papers')
    .select('*, products(name, target, slug)', { count: 'exact' })
    .eq('upload_status', 'verified')
    .eq('is_displayed', true)

  if (journal) {
    query = query.ilike('journal', `%${journal}%`)
  }
  if (productCatNo) {
    query = query.eq('product_cat_no', productCatNo)
  }

  if (sort === 'newest') {
    query = query.order('publication_date', { ascending: false })
  } else if (sort === 'oldest') {
    query = query.order('publication_date', { ascending: true })
  } else if (sort === 'highest_if') {
    query = query.order('impact_factor', { ascending: false })
  } else if (sort === 'lowest_if') {
    query = query.order('impact_factor', { ascending: true })
  }

  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    papers: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  })
}
