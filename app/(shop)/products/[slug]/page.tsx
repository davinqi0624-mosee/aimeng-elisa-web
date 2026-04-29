import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ProductDetailClient from '@/components/product/ProductDetailClient'

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

  const speciesList = (product.product_species || []).map(
    (s: any) => s.species
  ) as string[]
  const aliasList = (product.product_aliases || []).map(
    (a: any) => a.alias
  ) as string[]

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
                prices: product.prices,
                catalog_number: product.catalog_number,
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
      </div>
    </div>
  )
}
