import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSpeciesQueryValues, normalizeSpeciesList, normalizeSpeciesName } from '@/lib/products/species'
import { buildExactProductSearchValues, buildProductSearchOrConditions, normalizeSearchTerm, parseProductSearchIntent } from '@/lib/products/search'
import { normalizeElisaCatalogNumber } from '@/lib/products/catalog'
import { SHORT_PUBLIC_CACHE_HEADERS, getMemoryCached } from '@/lib/server/memory-cache'

const PRODUCT_SEARCH_SELECT = 'id, name, slug, target, price, detection_range, stock_status, citation_count, image_url, product_image, catalog_number, cat_no, species, product_species(species)'

type SearchProductRow = {
  id: string
  name?: string | null
  target?: string | null
  species?: string | null
  catalog_number?: string | null
  cat_no?: string | null
  product_species?: Array<{ species?: string | null }>
}

function dedupeProductsByCatalog<T extends SearchProductRow>(products: T[]) {
  return Object.values(
    products.reduce((acc: Record<string, T>, product) => {
      const catalog = product.catalog_number || product.cat_no
      const catalogKey = normalizeElisaCatalogNumber(catalog)
      const fallbackKey = `${product.species || ''}|${product.target || ''}|${product.name || ''}`.toLowerCase()
      const key = catalogKey || fallbackKey
      const existing = acc[key]
      const productCatalog = (catalog || '').toUpperCase()
      const existingCatalog = ((existing?.catalog_number || existing?.cat_no || '') as string).toUpperCase()
      const productIsBase = catalogKey && productCatalog === catalogKey
      const existingIsBase = catalogKey && existingCatalog === catalogKey
      const productIs96T = /M$/.test(productCatalog)
      const existingIs96T = /M$/.test(existingCatalog)

      if (!existing || productIsBase || (!existingIsBase && productIs96T && !existingIs96T)) {
        acc[key] = product
      }

      return acc
    }, {})
  )
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const species = normalizeSpeciesList(searchParams.get('species')?.split(',') || [])
  const query = normalizeSearchTerm(searchParams.get('query') || searchParams.get('q') || '')

  try {
    const cacheKey = `api:search:${species.join('|')}:${query}`
    const cached = await getMemoryCached(cacheKey, 2 * 60 * 1000, async () => {
      return searchProducts(species, query)
    })

    return NextResponse.json(cached.value, {
      headers: {
        ...SHORT_PUBLIC_CACHE_HEADERS,
        'X-Aimeng-Cache': cached.hit ? 'hit' : 'miss',
      },
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '搜索失败' }, { status: 500 })
  }
}

async function searchProducts(species: string[], query: string) {

  const supabase = await createClient()
  const intent = parseProductSearchIntent(query)
  const effectiveSpecies = species.length > 0 ? species : intent.species
  const searchTerm = intent.catalogLike ? intent.catalogQuery : intent.targetQuery
  const speciesQueryValues = effectiveSpecies.length > 0
    ? Array.from(new Set(effectiveSpecies.flatMap(getSpeciesQueryValues)))
    : []

  if (query) {
    const exactValues = buildExactProductSearchValues(searchTerm)
    const buildExactQuery = (field: 'target' | 'catalog_number' | 'cat_no') => {
      let exactQuery = supabase
        .from('products')
        .select(PRODUCT_SEARCH_SELECT)
        .eq('status', 'active')
        .or('species.is.null,species.not.ilike.%生化%')
        .not('name', 'ilike', '%生化法%')
        .in(field, exactValues)
        .order('is_featured', { ascending: false })
        .range(0, 47)

      if (speciesQueryValues.length > 0) exactQuery = exactQuery.in('species', speciesQueryValues)
      return exactQuery
    }

    const exactResults = await Promise.all([
      buildExactQuery('target'),
      buildExactQuery('catalog_number'),
      buildExactQuery('cat_no'),
    ])
    const exactError = exactResults.find((result) => result.error)?.error
    if (exactError) throw new Error(exactError.message)
    const exactProducts = dedupeProductsByCatalog(
      exactResults.flatMap((result) => (result.data || []) as SearchProductRow[])
    )

    if (exactProducts.length > 0) {
      const products = exactProducts.slice(0, 48).map((product) => ({
        ...product,
        species: normalizeSpeciesName(product.species),
        product_species: normalizeSpeciesList(product.product_species?.map((row) => row.species) || [])
          .map((species) => ({ species })),
      }))

      return {
        products,
        count: products.length,
        rawCount: products.length,
        filters: { species: effectiveSpecies, query },
        searchMode: 'exact',
      }
    }
  }

  let dbQuery = supabase
    .from('products')
    .select(PRODUCT_SEARCH_SELECT)
    .eq('status', 'active')
    .or('species.is.null,species.not.ilike.%生化%')
    .not('name', 'ilike', '%生化法%')

  // Species filter: exact canonical species match only. Avoid name fuzziness like "羊" matching both Sheep and Goat.
  if (effectiveSpecies.length > 0) {
    dbQuery = dbQuery.in('species', speciesQueryValues)
  }

  // Query filter (catalog number / target / aliases)
  if (query) {
    const searchVariants = buildProductSearchOrConditions(searchTerm)
    const { data: aliasMatches } = await supabase
      .from('product_aliases')
      .select('product_id')
      .or(buildProductSearchOrConditions(searchTerm, ['alias']).join(','))
    const aliasIds = [...new Set(aliasMatches?.map((r) => r.product_id) || [])]
    const conditions = [...searchVariants]
    if (aliasIds.length > 0) conditions.push(`id.in.(${aliasIds.join(',')})`)

    dbQuery = dbQuery.or(conditions.join(','))
  }

  const { data, error } = await dbQuery
    .order('is_featured', { ascending: false })
    .range(0, 47)

  if (error) {
    throw new Error(error.message)
  }

  const products = dedupeProductsByCatalog((data || []) as SearchProductRow[]).map((product) => ({
    ...product,
    species: normalizeSpeciesName(product.species),
    product_species: normalizeSpeciesList(product.product_species?.map((row) => row.species) || [])
      .map((species) => ({ species })),
  }))

  return {
    products,
    count: products.length,
    rawCount: products.length,
    filters: { species: effectiveSpecies, query },
    searchMode: 'fuzzy',
  }
}
