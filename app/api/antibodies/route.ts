import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const target = searchParams.get('target')
  const species = searchParams.get('species')

  let query = supabase
    .from('antibody_catalog')
    .select('*')
    .eq('status', 'active')
    .order('supplier', { ascending: true })

  if (target) {
    query = query.ilike('target', `%${target}%`)
  }
  if (species) {
    query = query.ilike('species', `%${species}%`)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ antibodies: data || [] })
}
