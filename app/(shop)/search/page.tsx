import { Suspense } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import ProductCard from '@/components/product/ProductCard'
import AdvancedSearch from '@/components/search/AdvancedSearch'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; species?: string }>
}) {
  const { q: rawQuery, species: speciesParam } = await searchParams
  const query = rawQuery || ''
  const speciesFilter = speciesParam ? speciesParam.split(',').filter(Boolean) : []

  const supabase = await createClient()

  // 尝试使用数据库搜索函数（支持希腊字母模糊匹配）
  let products: any[] | null = null
  let rpcError: any = null

  try {
    const { data, error } = await supabase.rpc('search_products', {
      search_query: query || null,
      species_filter: speciesFilter.length === 1 ? speciesFilter[0] : null,
    })
    if (error) throw error
    products = data
  } catch (err) {
    rpcError = err
    // 降级：直接使用 supabase-js 查询（不关联别名表）
    let dbQuery = supabase
      .from('products')
      .select('id, name, slug, target, price, detection_range, stock_status, citation_count, image_url')
      .eq('status', 'active')

    if (query) {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,target.ilike.%${query}%`)
    }

    const { data: fallbackData, error: fallbackError } = await dbQuery.order(
      'name'
    )

    if (!fallbackError) {
      products = fallbackData
    }
  }

  // 如果按种属筛选且 RPC 降级，需要进一步过滤
  if (rpcError && speciesFilter.length > 0 && products && products.length > 0) {
    const { data: speciesRows } = await supabase
      .from('product_species')
      .select('product_id')
      .in('species', speciesFilter)
    const allowedIds = new Set(speciesRows?.map((r) => r.product_id) || [])
    products = products.filter((p) => allowedIds.has(p.id))
  }

  // 如果 RPC 成功返回但有种属筛选，且返回了多种属结果，需要进一步过滤
  if (!rpcError && speciesFilter.length > 0 && products && products.length > 0) {
    const { data: speciesRows } = await supabase
      .from('product_species')
      .select('product_id, species')
      .in('species', speciesFilter)
    const allowedIds = new Set(speciesRows?.map((r) => r.product_id) || [])
    products = products.filter((p) => allowedIds.has(p.id))
  }

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
  }
  const typedProducts = (products || []) as ProductRow[]

  // 查询所有产品的种属（用于卡片显示）
  const productIds = typedProducts.map((p) => p.id)
  let speciesMap: Record<string, string[]> = {}
  if (productIds.length > 0) {
    const { data: speciesRows } = await supabase
      .from('product_species')
      .select('product_id, species')
      .in('product_id', productIds)
    speciesMap =
      speciesRows?.reduce((acc: Record<string, string[]>, row) => {
        if (!acc[row.product_id]) acc[row.product_id] = []
        acc[row.product_id].push(row.species)
        return acc
      }, {}) || {}
  }

  // 查询所有可用种属（用于筛选栏）
  const { data: allSpeciesRows } = await supabase
    .from('product_species')
    .select('species')
    .order('species')
  const speciesList = [
    ...new Set(allSpeciesRows?.map((r) => r.species) || []),
  ]

  const hasFilters = query || speciesFilter.length > 0

  return (
    <div className="h-full bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Search Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {hasFilters ? '筛选结果' : '所有产品'}
          </h1>
          <p className="text-gray-500 mt-1">
            共找到 {typedProducts.length} 款产品
          </p>
          {rpcError && (
            <p className="text-xs text-amber-600 mt-1">
              提示：搜索函数未就绪，已启用基础搜索模式
            </p>
          )}
        </div>

        {/* Advanced Search */}
        <div className="mb-8">
          <Suspense fallback={<div className="h-40 bg-white rounded-xl border border-gray-200 animate-pulse" />}>
            <AdvancedSearch
              availableSpecies={speciesList}
              targetPath="/search"
              queryParamName="q"
            />
          </Suspense>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {typedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              species={speciesMap[product.id] || []}
            />
          ))}
        </div>

        {typedProducts.length === 0 && (
          <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-400 text-lg mb-2">未找到匹配的产品</p>
            <p className="text-gray-400 text-sm">
              试试搜索 IL-6、TNF-alpha、IL-1β 等靶标
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
