import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/admin/permissions'

export async function GET(request: NextRequest) {
  const { error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const todayISO = todayStart.toISOString()

  const [{ data: todayProducts }, { data: todayDatasheets }, { data: stockStats }] = await Promise.all([
    supabase.from('products').select('id').gte('created_at', todayISO),
    supabase.from('auto_datasheets').select('id').gte('created_at', todayISO),
    supabase.from('products').select('stock_status'),
  ])

  const inStock = stockStats?.filter((p) => p.stock_status === 'in_stock').length || 0
  const outOfStock = stockStats?.filter((p) => p.stock_status === 'out_of_stock').length || 0

  return NextResponse.json({
    todayProducts: todayProducts?.length || 0,
    todayDatasheets: todayDatasheets?.length || 0,
    inStock,
    outOfStock,
  })
}
