'use client'

import Link from 'next/link'

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
  }
  species?: string[]
}

export default function ProductCard({ product, species = [] }: ProductCardProps) {
  return (
    <Link
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
          {species.slice(0, 1).map((s) => (
            <span
              key={s}
              className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full"
            >
              {s}
            </span>
          ))}
          {product.stock_status !== 'in_stock' && (
            <span className="px-2 py-0.5 bg-orange-50 text-orange-700 text-xs rounded-full">
              缺货
            </span>
          )}
          {(product.citation_count || 0) > 0 && (
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              {product.citation_count} 篇引用
            </span>
          )}
        </div>
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-1">
          {product.name}
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          检测范围: {product.detection_range}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-bold text-blue-600">¥1800 - ¥2400</p>
          <p className="text-xs text-gray-400">起</p>
        </div>
      </div>
    </Link>
  )
}
