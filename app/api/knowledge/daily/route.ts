import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'
    const category = searchParams.get('category') || null

    let query = supabase
      .from('daily_knowledge')
      .select('*, knowledge_versions(count)')
      .eq('lifecycle_status', 'active')

    if (!all) {
      const today = new Date().toISOString().split('T')[0]
      const startOfMonth = today.slice(0, 7) + '-01'
      query = query.gte('date', startOfMonth).lte('date', today)
    }

    if (category) {
      query = query.eq('category', category)
    }

    const { data, error } = await query.order('date', { ascending: false })
    if (error) throw error

    return NextResponse.json({ items: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
