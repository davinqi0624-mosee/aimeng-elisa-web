import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { MessageSquare, CalendarDays, FlaskConical } from 'lucide-react'

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ species?: string }>
}) {
  const { species: speciesFilter } = await searchParams
  const activeSpecies = speciesFilter || 'all'

  const supabase = await createClient()

  let productIds: string[] | null = null
  if (activeSpecies !== 'all') {
    const { data } = await supabase
      .from('product_species')
      .select('product_id')
      .eq('species', activeSpecies)
    productIds = data?.map((r) => r.product_id) || []
  }

  let query = supabase
    .from('products')
    .select('*, product_species(species)')
    .eq('status', 'active')
    .order('is_featured', { ascending: false })

  if (activeSpecies !== 'all' && productIds && productIds.length > 0) {
    query = query.in('id', productIds)
  } else if (activeSpecies !== 'all') {
    query = query.eq('id', '00000000-0000-0000-0000-000000000000')
  }

  const { data: products } = await query

  const { data: speciesRows } = await supabase
    .from('product_species')
    .select('species')
    .order('species')
  const speciesList = [
    ...new Set(speciesRows?.map((r) => r.species) || []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-blue-600 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            ELISA 生态网站
          </h1>
          <p className="text-xl mb-8">
            专业 ELISA 试剂盒搜索与采购平台
          </p>
          <form action="/search" className="flex max-w-xl mx-auto">
            <input
              name="q"
              type="text"
              placeholder="搜索靶标、种属、别名..."
              className="flex-1 px-4 py-3 rounded-l-lg text-gray-900 outline-none"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-blue-800 rounded-r-lg hover:bg-blue-900 font-medium"
            >
              搜索
            </button>
          </form>
        </div>
      </section>

      {/* Feature Entries */}
      <section className="py-3 px-4 bg-gradient-to-r from-blue-50 to-violet-50 border-b border-blue-100">
        <div className="max-w-6xl mx-auto flex items-center gap-4 flex-wrap">
          <Link
            href="/chat"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 rounded-lg hover:border-blue-400 hover:shadow-sm transition-all"
          >
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <div>
              <div className="text-xs font-semibold text-gray-900">AI 智能客服</div>
              <div className="text-[10px] text-gray-500">售前/售后/方案</div>
            </div>
          </Link>
          <Link
            href="/knowledge"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-emerald-200 rounded-lg hover:border-emerald-400 hover:shadow-sm transition-all"
          >
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            <div>
              <div className="text-xs font-semibold text-gray-900">每日知识</div>
              <div className="text-[10px] text-gray-500">ELISA 每日学习</div>
            </div>
          </Link>
          <Link
            href="/lab/experiment"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-violet-200 rounded-lg hover:border-violet-400 hover:shadow-sm transition-all"
          >
            <FlaskConical className="w-4 h-4 text-violet-600" />
            <div>
              <div className="text-xs font-semibold text-gray-900">实验方案</div>
              <div className="text-[10px] text-gray-500">AI 生成实验设计</div>
            </div>
          </Link>
          <Link
            href="/lab/analysis"
            className="flex items-center gap-2 px-3 py-2 bg-white border border-orange-200 rounded-lg hover:border-orange-400 hover:shadow-sm transition-all"
          >
            <FlaskConical className="w-4 h-4 text-orange-600" />
            <div>
              <div className="text-xs font-semibold text-gray-900">数据分析</div>
              <div className="text-[10px] text-gray-500">4PL 拟合/报告</div>
            </div>
          </Link>
        </div>
      </section>

      {/* Species Filter */}
      <section className="py-4 px-4 bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex gap-3 overflow-x-auto">
          <Link
            href="/"
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              activeSpecies === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            全部
          </Link>
          {speciesList.map((s) => (
            <Link
              key={s}
              href={`/?species=${s}`}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                activeSpecies === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </section>

      {/* Product Grid */}
      <section className="py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">热门产品</h2>
            <span className="text-gray-500 text-sm">
              共 {products?.length || 0} 款
            </span>
          </div>

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
              <p className="text-gray-400 text-lg">暂无产品</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
