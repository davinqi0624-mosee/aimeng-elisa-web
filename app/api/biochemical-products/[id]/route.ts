import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SHORT_PUBLIC_CACHE_HEADERS } from '@/lib/server/memory-cache'

export const dynamic = 'force-dynamic'

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isUuid(id)) return NextResponse.json({ error: '产品地址无效' }, { status: 400 })

  const supabase = await createClient()
  const { data: product, error: productError } = await supabase
    .from('biochemical_products')
    .select('id, catalog_number, indicator_name, specifications, wavelength, price_48t, price_96t, status, sort_order')
    .eq('id', id)
    .eq('status', 'active')
    .maybeSingle()

  if (productError) return NextResponse.json({ error: productError.message }, { status: 500 })
  if (!product) return NextResponse.json({ error: '未找到该生化产品' }, { status: 404 })

  const { data: document, error: documentError } = await supabase
    .from('biochemical_product_documents')
    .select('id, file_url, file_name, created_at')
    .eq('biochemical_product_id', id)
    .eq('status', 'active')
    .maybeSingle()

  if (documentError && !/relation|table|schema cache/i.test(documentError.message)) {
    return NextResponse.json({ error: documentError.message }, { status: 500 })
  }

  return NextResponse.json(
    { product, document: document || null },
    { headers: SHORT_PUBLIC_CACHE_HEADERS },
  )
}
