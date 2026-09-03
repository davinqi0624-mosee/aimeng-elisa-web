import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SHORT_PUBLIC_CACHE_HEADERS, getMemoryCached } from '@/lib/server/memory-cache'

export async function GET() {
  try {
    const cached = await getMemoryCached('api:shop-items:active', 60 * 1000, async () => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('shop_items')
        .select('*')
        .eq('status', 'active')
        .order('sort_order', { ascending: true })

      if (error) throw new Error(error.message)
      return { items: data || [] }
    })

    return NextResponse.json(cached.value, {
      headers: {
        ...SHORT_PUBLIC_CACHE_HEADERS,
        'X-Aimeng-Cache': cached.hit ? 'hit' : 'miss',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '商品读取失败' }, { status: 500 })
  }
}
