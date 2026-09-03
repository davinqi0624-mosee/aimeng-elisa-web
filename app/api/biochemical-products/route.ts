import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SHORT_PUBLIC_CACHE_HEADERS, getMemoryCached } from '@/lib/server/memory-cache'

export const dynamic = 'force-dynamic'

type BiochemicalProductRow = {
  id: string
  catalog_number: string
  indicator_name: string
  specifications: string[]
  wavelength: string
  price_48t: number | string | null
  price_96t: number | string
  status: string
  sort_order: number
}

type LegacyBiochemicalProductRow = {
  id: string
  catalog_number: string
  indicator_name: string
  specification: string | null
  wavelength: string
  price: number | string | null
  status: string
  sort_order: number
}

function cleanQuery(value: string) {
  return value.replace(/[%,()]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
}

function isMissingTable(message?: string) {
  if (!message || /column .*?(does not exist|not found in schema cache)/i.test(message)) return false
  return /(?:relation|table).*biochemical_products.*does not exist|biochemical_products.*table.*not found in schema cache/i.test(message)
}

function isMissingModernColumns(message?: string) {
  return Boolean(message && /specifications|price_96t|price_48t/i.test(message) && /schema cache|column .* does not exist/i.test(message))
}

function normalizeLegacyProduct(product: LegacyBiochemicalProductRow): BiochemicalProductRow {
  const specification = product.specification?.trim().toUpperCase() === '48T' ? '48T' : '96T'
  return {
    id: product.id,
    catalog_number: product.catalog_number,
    indicator_name: product.indicator_name,
    specifications: [specification],
    wavelength: product.wavelength,
    price_48t: specification === '48T' ? product.price : null,
    price_96t: product.price ?? 0,
    status: product.status,
    sort_order: product.sort_order,
  }
}

export async function GET(request: NextRequest) {
  const query = cleanQuery(new URL(request.url).searchParams.get('q') || '')
  const cacheKey = `public:biochemical-products:${query.toLowerCase()}`

  try {
    const cached = await getMemoryCached(cacheKey, 60 * 1000, async () => {
      const supabase = await createClient()
      let productsQuery = supabase
        .from('biochemical_products')
        .select('id, catalog_number, indicator_name, specifications, wavelength, price_48t, price_96t, status, sort_order')
        .eq('status', 'active')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false })
        .limit(100)

      if (query) {
        productsQuery = productsQuery.or(
          `catalog_number.ilike.%${query}%,indicator_name.ilike.%${query}%,wavelength.ilike.%${query}%`,
        )
      }

      const { data, error } = await productsQuery
      if (error) {
        if (isMissingTable(error.message)) return { products: [], needsSetup: true }
        if (isMissingModernColumns(error.message)) {
          let legacyQuery = supabase
            .from('biochemical_products')
            .select('id, catalog_number, indicator_name, specification, wavelength, price, status, sort_order')
            .eq('status', 'active')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(100)

          if (query) {
            legacyQuery = legacyQuery.or(
              `catalog_number.ilike.%${query}%,indicator_name.ilike.%${query}%,wavelength.ilike.%${query}%`,
            )
          }

          const legacyResult = await legacyQuery
          if (legacyResult.error) throw legacyResult.error
          return {
            products: (legacyResult.data || []).map((product) => normalizeLegacyProduct(product as LegacyBiochemicalProductRow)),
            needsSetup: false,
            needsMigration: true,
          }
        }
        throw error
      }

      return { products: (data || []) as BiochemicalProductRow[], needsSetup: false, needsMigration: false }
    })

    return NextResponse.json(cached.value, {
      headers: {
        ...SHORT_PUBLIC_CACHE_HEADERS,
        'X-Aimeng-Cache': cached.hit ? 'hit' : 'miss',
      },
    })
  } catch (error) {
    console.error('[biochemical-products]', error)
    return NextResponse.json({ products: [], error: '生化产品目录暂时无法读取' }, { status: 500 })
  }
}
