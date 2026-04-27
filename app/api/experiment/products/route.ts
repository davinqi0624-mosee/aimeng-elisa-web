import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('products')
      .select('id,name,target,detection_range')
      .eq('status', 'active')
      .order('name')
    if (error) throw error
    return NextResponse.json({ products: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
