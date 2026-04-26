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

  // 1. 通过别名匹配产品ID
  let aliasIds: string[] = []
  if (query) {
    const { data: aliasRows } = await supabase
      .from('product_aliases')
      .select('product_id')
      .ilike('alias', `%${query}%`)
    aliasIds = aliasRows?.map((r) => r.product_id) || []
  }

  // 2. 通过名称/靶标匹配产品ID
  let nameIds: string[] = []
  if (query) {
    const { data: nameRows } = await supabase
      .from('products')
      .select('id')
      .eq('status', 'active')
      .or(`name.ilike.%${query}%,target.ilike.%${query}%`)
    nameIds = nameRows?.map((r) => r.id) || []
  }

  const matchedIds = [...new Set([...aliasIds, ...nameIds])]

  // 3. 种属筛选
  let speciesIds: string[] | null = null
  if (activeSpecies !== 'all') {
    const { data } = await supabase
      .from('product_species')
      .select('product_id')
      .eq('species', activeSpecies)
    speciesIds = data?.map((r) => r.product_id) || []
  }

  // 4. 组装最终查询
  let dbQuery = supabase
    .from('products')
    .select('*, product_species(species)')
    .eq('status', 'active')

  if (query) {
    if (matchedIds.length > 0) {
      dbQuery = dbQuery.in('id', matchedIds)
    } else {
      dbQuery = dbQuery.eq(
        'id',
        '00000000-0000-0000-0000-000000000000'
      )
    }
  }

  if (activeSpecies !== 'all' && speciesIds && speciesIds.length > 0) {
    dbQuery = dbQuery.in('id', speciesIds)
  } else if (activeSpecies !== 'all') {
    dbQuery = dbQuery.eq(
      'id',
      '00000000-0000-0000-0000-000000000000'
    )
  }

  const { data: products } = await dbQuery

  const { data: speciesRows } = await supabase
    .from('product_species')
    .select('species')
    .order('species')
  const speciesList = [
    ...new Set(speciesRows?.map((r) => r.species) || []),
  ]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Search Header */}
        <div className="mb-8">
          <form action="/search" className="flex max-w-xl mb-4">
            <input
              name="q"
              type="text"
              defaultValue={query}
              placeholder="搜索靶标、种属、别名..."
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
            共找到 {products?.length || 0} 款产品
          </p>
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
          {products?.map((product) => (
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
                  {(product.product_species as any[])
                    ?.slice(0, 1)
                    .map((s: any) => (
                      <span
                        key={s.species}
                        className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
                      >
                        {s.species}
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

        {(!products || products.length === 0) && (
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
