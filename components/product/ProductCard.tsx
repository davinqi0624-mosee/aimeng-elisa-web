'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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

function extractTargetAbbrev(target: string): string {
  if (!target) return '--'
  // Try to extract the main target name, e.g. "Human IL-6 ELISA Kit" -> "IL-6"
  const match = target.match(/([A-Za-z0-9\-αβγδεζηθικλμνξοπρστυφχψω]+)/)
  if (match) {
    const abbr = match[1]
    return abbr.length > 8 ? abbr.slice(0, 8) : abbr
  }
  return target.slice(0, 6)
}

export default function ProductCard({ product, species = [] }: ProductCardProps) {
  const isInStock = product.stock_status === 'in_stock'
  const targetAbbr = extractTargetAbbrev(product.target)

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group block bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-blue-300 transition-colors"
    >
      {/* Product Image Placeholder — branded gradient circle */}
      <div className="h-48 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center group-hover:from-blue-50 group-hover:to-emerald-50 transition-colors">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm text-center leading-tight px-1">
            {targetAbbr}
          </span>
        </div>
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
