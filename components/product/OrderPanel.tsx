'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, MessageSquare, Check, Truck, Receipt, Clock } from 'lucide-react'

interface OrderPanelProps {
  catNo: string
  name: string
  target: string
  basePrice: number
  stockStatus: string
  datasheetUrl?: string | null
}

const SIZE_PRICES: Record<string, number> = {
  '48T': 1800,
  '96T': 2400,
}

export default function OrderPanel({
  catNo,
  name,
  target,
  basePrice,
  stockStatus,
  datasheetUrl,
}: OrderPanelProps) {
  const availableSizes = ['48T', '96T']
  const [selectedSize, setSelectedSize] = useState<string>('96T')

  const currentPrice = SIZE_PRICES[selectedSize]
  const inStock = stockStatus === 'in_stock'

  return (
    <div className="bg-blue-50 rounded-xl border border-blue-100 p-6 space-y-6">
      {/* Catalog Number */}
      <div>
        <p className="text-xs text-slate-500 mb-1">货号</p>
        <p className="text-2xl font-bold text-slate-900">{catNo}</p>
        <p className="text-sm text-slate-600 mt-1">{name}</p>
      </div>

      {/* Size Selector */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">规格选择</p>
        <div className="flex gap-3">
          {availableSizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`flex-1 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                selectedSize === size
                  ? 'border-blue-500 bg-white text-blue-700 shadow-sm'
                  : 'border-blue-200 bg-white/60 text-slate-600 hover:bg-white'
              }`}
            >
              <span className="block text-base font-bold">{size}</span>
              <span className="text-xs text-slate-400">¥{SIZE_PRICES[size]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price & Stock */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-1">价格</p>
          <p className="text-3xl font-bold text-blue-600">
            ¥{currentPrice}
            <span className="text-sm font-normal text-slate-400 ml-1">/ {selectedSize}</span>
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
            inStock
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {inStock ? (
            <>
              <Check className="w-3.5 h-3.5" />
              现货
            </>
          ) : (
            <>
              <Clock className="w-3.5 h-3.5" />
              预订
            </>
          )}
        </span>
      </div>

      {/* CTA Buttons */}
      <div className="space-y-3">
        {datasheetUrl ? (
          <a
            href={datasheetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            查看说明书PDF
          </a>
        ) : (
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-200 text-slate-400 rounded-lg font-semibold cursor-not-allowed"
          >
            <FileText className="w-4 h-4" />
            说明书暂缺
          </button>
        )}
        <Link
          href="/chat"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold hover:border-slate-300 transition-colors"
        >
          <MessageSquare className="w-4 h-4" />
          联系客服咨询
        </Link>
      </div>

      {/* Service Tags */}
      <div className="pt-4 border-t border-blue-200/60">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <Receipt className="w-3.5 h-3.5" />
            增值税专用发票
          </span>
          <span className="inline-flex items-center gap-1">
            <Truck className="w-3.5 h-3.5" />
            当日发货
          </span>
          <span className="inline-flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            支持对公转账
          </span>
        </div>
      </div>
    </div>
  )
}
