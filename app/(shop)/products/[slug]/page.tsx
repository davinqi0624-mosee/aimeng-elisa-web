import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: product } = await supabase
    .from('products')
    .select(
      '*, product_species(species, species_name_zh), product_aliases(alias, alias_type)'
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!product) {
    notFound()
  }

  const speciesList = (product.product_species || []) as any[]
  const aliasList = (product.product_aliases || []) as any[]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="text-blue-600 hover:underline mb-6 inline-block text-sm"
        >
          ← 返回产品列表
        </Link>

        <div className="bg-white rounded-2xl shadow-sm p-8">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Image */}
            <div className="w-full lg:w-2/5">
              <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                <span className="text-gray-400">产品图片</span>
              </div>
            </div>

            {/* Info */}
            <div className="w-full lg:w-3/5">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-sm rounded-full font-medium">
                  {product.target}
                </span>
                <span
                  className={`px-2.5 py-1 text-sm rounded-full font-medium ${
                    product.stock_status === 'in_stock'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-orange-50 text-orange-700'
                  }`}
                >
                  {product.stock_status === 'in_stock' ? '现货' : '缺货'}
                </span>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>

              <p className="text-3xl font-bold text-blue-600 mb-8">
                ¥{product.price}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">检测范围</p>
                  <p className="font-semibold text-gray-900">
                    {product.detection_range}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">灵敏度</p>
                  <p className="font-semibold text-gray-900">
                    {product.sensitivity}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">适用样本</p>
                  <p className="font-semibold text-gray-900">
                    {product.sample_type?.join('、')}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">适用种属</p>
                  <p className="font-semibold text-gray-900">
                    {speciesList.map((s) => s.species).join('、')}
                  </p>
                </div>
              </div>

              {aliasList.length > 0 && (
                <div className="mb-8">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    常用别名
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {aliasList.map((a, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
                      >
                        {a.alias}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
                立即咨询
              </button>
            </div>
          </div>

          {product.description && (
            <div className="mt-10 pt-8 border-t">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                产品描述
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
