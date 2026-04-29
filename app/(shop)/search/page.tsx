import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; species?: string }>
}) {
  const { q: rawQuery, species: speciesFilter } = await searchParams
  const query = rawQuery || ''
  const activeSpecies = speciesFilter || 'all'

  const supabase = await createClient()

  // 尝试使用数据库搜索函数（支持别名模糊匹配）
  let products: any[] | null = null
  let rpcError: any = null

  try {
    const { data, error } = await supabase.rpc('search_products', {
      search_query: query || null,
      species_filter: activeSpecies !== 'all' ? activeSpecies : null,
    })
    if (error) throw error
    products = data
  } catch (err) {
    rpcError = err
    // 降级：直接使用 supabase-js 查询（不关联别名表）
    let dbQuery = supabase
      .from('products')
      .select('id, name, slug, target, price, detection_range, stock_status')
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
  if (rpcError && activeSpecies !== 'all' && products && products.length > 0) {
    const { data: speciesRows } = await supabase
      .from('product_species')
      .select('product_id')
      .eq('species', activeSpecies)
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

  return (
    <div className="h-full bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Search Header */}
        <div className="mb-8">
          <form action="/search" className="flex max-w-xl mb-4">
            <input
              name="q"
              type="text"
              defaultValue={query}
              placeholder="搜索靶标、种属、别名...（试试 IL1b、TNFa、IFNg）"
              className="flex-1 px-4 py-3 rounded-l-lg border border-r-0 border-gray-300 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 text-white rounded-r-lg hover:bg-blue-700 font-medium"
            >
              搜索
            </button>
          </form>

          <h1 className="text-2xl font-bold text-gray-900">
            {query ? `「${query}」的搜索结果` : '所有产品'}
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

        {/* Species Filter */}
        <div className="flex gap-3 mb-8 overflow-x-auto">
          <Link
            href={`/search?q=${encodeURIComponent(query)}`}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              activeSpecies === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            全部
          </Link>
          {speciesList.map((s) => (
            <Link
              key={s}
              href={`/search?q=${encodeURIComponent(query)}&species=${s}`}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeSpecies === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {s}
            </Link>
          ))}
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {typedProducts.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden group"
            >
              <div className="h-48 bg-gray-100 flex items-center justify-center group-hover:bg-gray-50 transition-colors">
                <span className="text-gray-400 text-sm">产品图片</span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                    {product.target}
                  </span>
                  {speciesMap[product.id]?.slice(0, 1).map((s) => (
                    <span
                      key={s}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
                  {product.name}
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  检测范围: {product.detection_range}
                </p>
                <p className="text-lg font-bold text-blue-600">
                  ¥{product.price}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {typedProducts.length === 0 && (
          <div className="text-center py-20">
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
