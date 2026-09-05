import { Suspense } from 'react'
import { FileText, Microscope, Search, Tags } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/product/ProductCard'
import AdvancedSearch from '@/components/search/AdvancedSearch'
import {
  SPECIES_NAME_PATTERNS,
  SPECIES_ORDER,
  getSpeciesQueryValues,
  normalizeSpeciesList,
  normalizeSpeciesName,
} from '@/lib/products/species'
import { buildExactProductSearchValues, buildProductSearchOrConditions, normalizeSearchTerm } from '@/lib/products/search'
import { normalizeElisaCatalogNumber } from '@/lib/products/catalog'
import { getElisaTestingServiceForm } from '@/lib/downloads/service-forms-server'
import { getMemoryCached } from '@/lib/server/memory-cache'

type ProductRow = {
  id: string
  name: string
  slug: string
  target: string
  price: number
  detection_range: string
  stock_status: string
  citation_count?: number
  image_url?: string
  product_image?: string
  catalog_number?: string | null
  cat_no?: string | null
  species?: string | null
  product_species?: Array<{ species: string }>
}

const PRODUCT_SEARCH_SELECT = 'id, name, slug, target, price, detection_range, stock_status, citation_count, image_url, product_image, catalog_number, cat_no, species, product_species(species)'

function inferSpeciesFromProduct(product: { name?: string; species?: string | null }) {
  if (product.species) return normalizeSpeciesName(product.species)
  const name = product.name || ''
  for (const [species, patterns] of Object.entries(SPECIES_NAME_PATTERNS)) {
    if (patterns.some((pattern) => name.toLowerCase().includes(pattern.toLowerCase()))) {
      return species
    }
  }
  return ''
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; query?: string; species?: string }>
}) {
  const { q: rawQuery, query: legacyQuery, species: speciesParam } = await searchParams
  const query = rawQuery || legacyQuery || ''
  const speciesFilter = normalizeSpeciesList(speciesParam ? speciesParam.split(',') : [])
  const hasFilters = query.trim().length > 0 || speciesFilter.length > 0

  const elisaTestingServiceForm = await getElisaTestingServiceForm()

  let products: ProductRow[] = []
  let productsError: { message?: string } | null = null

  if (hasFilters) {
    const searchTerm = normalizeSearchTerm(query)
    const cacheKey = `page:products-elisa:${speciesFilter.join('|')}:${searchTerm}`
    const cached = await getMemoryCached(cacheKey, 2 * 60 * 1000, async () => {
      const supabase = await createClient()
      const speciesQueryValues = speciesFilter.length > 0
        ? Array.from(new Set(speciesFilter.flatMap(getSpeciesQueryValues)))
        : []

      if (searchTerm) {
        const exactValues = buildExactProductSearchValues(searchTerm)
        const buildExactQuery = (field: 'target' | 'catalog_number' | 'cat_no') => {
          let exactQuery = supabase
            .from('products')
            .select(PRODUCT_SEARCH_SELECT)
            .eq('status', 'active')
            .or('species.is.null,species.not.ilike.%生化%')
            .not('name', 'ilike', '%生化法%')
            .in(field, exactValues)
            .order('name')
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
        if (exactError) return { products: [], error: { message: exactError.message } }
        const exactProducts = exactResults.flatMap((result) => (result.data || []) as ProductRow[])
        if (exactProducts.length > 0) {
          return { products: exactProducts.slice(0, 48), error: null }
        }
      }

      let productsQuery = supabase
        .from('products')
        .select(PRODUCT_SEARCH_SELECT, { count: 'exact' })
        .eq('status', 'active')
        .or('species.is.null,species.not.ilike.%生化%')
        .not('name', 'ilike', '%生化法%')

      if (searchTerm) {
        const { data: aliasMatches } = await supabase
          .from('product_aliases')
          .select('product_id')
          .or(buildProductSearchOrConditions(searchTerm, ['alias']).join(','))
        const aliasIds = [...new Set(aliasMatches?.map((row) => row.product_id) || [])]
        const conditions = buildProductSearchOrConditions(searchTerm)
        if (aliasIds.length > 0) conditions.push(`id.in.(${aliasIds.join(',')})`)
        productsQuery = productsQuery.or(conditions.join(','))
      }

      if (speciesFilter.length > 0) {
        productsQuery = productsQuery.in('species', speciesQueryValues)
      }

      const result = await productsQuery.order('name').range(0, 47)
      return {
        products: ((result.data || []) as ProductRow[]),
        error: result.error ? { message: result.error.message } : null,
      }
    })
    products = cached.value.products
    productsError = cached.value.error
  }

  const typedProducts = products || []
  const dedupedProducts = Object.values(
    typedProducts.reduce((acc: Record<string, ProductRow>, product) => {
      const catalog = product.catalog_number || product.cat_no
      const catalogKey = normalizeElisaCatalogNumber(catalog)
      const speciesKey = product.species || inferSpeciesFromProduct(product)
      const fallbackKey = `${speciesKey}|${product.target || ''}|${product.name || ''}`.toLowerCase()
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

  const speciesMap: Record<string, string[]> = {}
  for (const product of dedupedProducts) {
    const productSpecies = normalizeSpeciesList(product.product_species?.map((row) => row.species) || [])
    if (productSpecies.length > 0) speciesMap[product.id] = productSpecies
  }

  for (const product of dedupedProducts) {
    if (!speciesMap[product.id]?.length) {
      const inferredSpecies = inferSpeciesFromProduct(product)
      if (inferredSpecies) speciesMap[product.id] = [inferredSpecies]
    }
  }

  const speciesList = SPECIES_ORDER

  const searchExamples = ['IL-6', 'TNF-alpha', 'IL-1β', 'SOD', 'LV10001']

  return (
    <div className="h-full bg-[#F2F6FA] py-10 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Search Header */}
        <div className="mb-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            aimeng.products / elisa catalog
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-normal text-slate-950 mb-1">
            {hasFilters ? 'ELISA 试剂盒筛选结果' : 'ELISA 试剂盒搜索'}
          </h1>
          <p className="text-slate-500 mt-1">
            {hasFilters
              ? `按货号、指标、种属、希腊字母快速查找试剂盒，共找到 ${dedupedProducts.length} 款产品`
              : '请选择种属，或输入货号、指标名称、英文缩写开始检索。'}
          </p>
          {productsError && (
            <p className="text-xs text-amber-600 mt-1">
              提示：产品检索暂时异常，请刷新后重试或联系人工客服
            </p>
          )}
        </div>

        <div className="mb-8 rounded-lg border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">需要 ELISA 代测服务？</p>
              <p className="mt-1 text-sm text-slate-500">
                可先下载通用代测申请表，填写样本信息、检测指标和报告要求后联系客服确认。
              </p>
            </div>
            <a
              href={elisaTestingServiceForm.href}
              download={elisaTestingServiceForm.fileName}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700"
            >
              <FileText className="h-4 w-4" />
              下载代测申请表
            </a>
          </div>
        </div>

        {/* Advanced Search */}
        <div className="mb-8">
          <Suspense fallback={<div className="h-40 bg-white rounded-lg border border-slate-200 animate-pulse" />}>
            <AdvancedSearch
              availableSpecies={speciesList}
              targetPath="/products/elisa"
              queryParamName="q"
            />
          </Suspense>
        </div>

        {!hasFilters && (
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-950 text-white">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">从客户需求开始检索</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      输入指标、货号或选择种属后，系统会展示对应 ELISA 试剂盒，不再默认展示某一种属产品。
                    </p>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <Microscope className="h-5 w-5 text-teal-700" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">按种属筛选</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">适合先确定样本来源，如人、小鼠、大鼠、牛、犬等。</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <Tags className="h-5 w-5 text-teal-700" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">按指标搜索</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">适合输入 IL-6、TNF-alpha、SOD 等靶标或中文名称。</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <FileText className="h-5 w-5 text-teal-700" />
                    <p className="mt-3 text-sm font-semibold text-slate-900">按货号精准查询</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">适合已有货号时快速进入产品页查看规格、价格和说明书。</p>
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-5">
                <p className="text-sm font-semibold text-teal-700">常用搜索示例</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {searchExamples.map((example) => (
                    <a
                      key={example}
                      href={`/products/elisa?q=${encodeURIComponent(example)}`}
                      className="rounded-full border border-teal-200 bg-white px-3 py-1.5 text-sm font-medium text-teal-800 hover:border-teal-400 hover:bg-teal-100"
                    >
                      {example}
                    </a>
                  ))}
                </div>
                <p className="mt-4 text-xs leading-5 text-slate-500">
                  如果没有找到目标产品，可直接联系人工客服确认定制、代测或替代产品方案。
                </p>
              </div>
            </div>
          </div>
        )}

        {hasFilters && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {dedupedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={{
                    id: product.id,
                    name: product.name,
                    slug: product.slug,
                    target: product.target,
                    catalog_number: product.catalog_number || product.cat_no,
                    detection_range: product.detection_range,
                    stock_status: product.stock_status,
                    citation_count: product.citation_count,
                    image_url: product.image_url || product.product_image,
                  }}
                  species={speciesMap[product.id] || []}
                />
              ))}
            </div>

            {dedupedProducts.length === 0 && (
              <div className="text-center py-20 bg-white rounded-lg border border-slate-200">
                <p className="text-slate-400 text-lg mb-2">未找到匹配的产品</p>
                <p className="text-slate-400 text-sm">
                  试试搜索 IL-6、TNF-alpha、IL-1β 等靶标，或联系人工客服确认
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
