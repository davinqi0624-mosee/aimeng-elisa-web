'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const DEFAULT_IMAGES = [
  '/images/elisa/elisa_sandwich_sketch.jpg',
  '/images/elisa/elisa_sandwich_lego.jpg',
  '/images/elisa/elisa_sandwich_pencil.jpg',
]

interface ProductCardProps {
  product: {
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
  species?: string[]
}

function getDefaultImage(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % DEFAULT_IMAGES.length
  return DEFAULT_IMAGES[index]
}

export default function ProductCard({ product, species = [] }: ProductCardProps) {
  const isInStock = product.stock_status === 'in_stock'
  const displayImage = product.image_url || getDefaultImage(product.id)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all"
    >
      {/* Product Image */}
      <div className="h-48 w-full overflow-hidden bg-slate-50">
        <img
          src={displayImage}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      </div>

      <div className="p-6">
        {/* Tags */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-semibold">
            {product.target}
          </span>
          {species.slice(0, 1).map((s) => (
            <span
              key={s}
              className="px-2.5 py-1 bg-slate-50 text-slate-600 text-xs rounded-md border border-slate-200 font-medium"
            >
              {s}
            </span>
          ))}
          {!isInStock && (
            <span className="px-2.5 py-1 bg-orange-50 text-orange-700 text-xs rounded-md font-semibold">
              缺货
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-bold text-slate-900 mb-2 line-clamp-1 group-hover:text-blue-700 transition-colors">
          {product.name}
        </h3>

        {/* Detection Range */}
        <p className="text-sm text-slate-500 mb-4">
          检测范围 {product.detection_range}
        </p>

        {/* Bottom row: price + citations + button */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-slate-900">¥{product.price}</span>
          </div>
          <div className="flex items-center gap-3">
            {(product.citation_count || 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                {product.citation_count} 引用
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:translate-x-0.5 transition-transform">
              详情 <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
