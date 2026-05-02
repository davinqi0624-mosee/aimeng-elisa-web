import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductDetailClient from '@/components/product/ProductDetailClient'
import PlateCalculator from '@/components/calculator/PlateCalculator'

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
      '*, product_species(species, species_name_zh), product_aliases(alias, alias_type), cat_no, citation_count'
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!product) {
    notFound()
  }

  const speciesList = (product.product_species || []).map(
    (s: any) => s.species
  ) as string[]
  const aliasList = (product.product_aliases || []).map(
    (a: any) => a.alias
  ) as string[]

  // Fetch verified citations for this product
  const { data: citations } = await supabase
    .from('papers')
    .select('id, title, authors, journal, doi, impact_factor, publication_date')
    .eq('product_cat_no', product.cat_no)
    .eq('upload_status', 'verified')
    .eq('is_displayed', true)
    .order('impact_factor', { ascending: false })

  return (
    <div className="h-full bg-gray-50 py-8 px-4">
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

            {/* Info - Client Component */}
            <ProductDetailClient
              product={{
                id: product.id,
                name: product.name,
                target: product.target,
                price: product.price,
                detection_range: product.detection_range,
                sensitivity: product.sensitivity,
                sample_type: product.sample_type || [],
                stock_status: product.stock_status,
              }}
              speciesList={speciesList}
              aliasList={aliasList}
            />
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

        {/* Plate Calculator */}
        <div className="mt-6">
          <PlateCalculator />
        </div>

        {/* Citations Section */}
        {(citations && citations.length > 0) ? (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                文献引用
              </h2>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                {citations.length} 篇 SCI 论文
              </span>
            </div>
            <div className="space-y-4">
              {citations.map((c) => (
                <div
                  key={c.id}
                  className="border rounded-xl p-4 hover:border-indigo-200 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900 mb-1">
                    {c.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-2">{c.authors}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="font-medium text-gray-600">
                      {c.journal}
                    </span>
                    <span>IF: {c.impact_factor || '-'}</span>
                    <span>
                      {c.publication_date
                        ? new Date(c.publication_date).getFullYear()
                        : '-'}
                    </span>
                    {c.doi && (
                      <a
                        href={`https://doi.org/${c.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        DOI: {c.doi}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-gray-400 mb-2">暂无引用文献</p>
            <p className="text-sm text-gray-500">
              使用本产品发表论文？
              <Link
                href="/user/citations/submit"
                className="text-blue-600 hover:underline ml-1"
              >
                提交引用文献获得积分奖励 →
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
