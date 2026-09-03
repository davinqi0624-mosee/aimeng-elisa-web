import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = await createClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [
    { count: todayProducts },
    { count: todayDatasheets },
    { count: inStock },
    { count: outOfStock },
  ] = await Promise.all([
    supabase.from('products').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('auto_datasheets').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('stock_status', 'in_stock'),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('stock_status', 'out_of_stock'),
  ])

  return NextResponse.json({
    todayProducts: todayProducts || 0,
    todayDatasheets: todayDatasheets || 0,
    inStock: inStock || 0,
    outOfStock: outOfStock || 0,
  })
}
