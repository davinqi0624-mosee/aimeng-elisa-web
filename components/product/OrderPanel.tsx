'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileText, MessageSquare, Check, Clock } from 'lucide-react'

interface OrderPanelProps {
  catNo: string
  name: string
  target: string
  species?: string | null
  price48t?: number | null
  price96t?: number | null
  stockStatus: string
  datasheetUrl?: string | null
}

export default function OrderPanel({
  catNo,
  name,
  target,
  species,
  price48t,
  price96t,
  stockStatus,
  datasheetUrl,
}: OrderPanelProps) {
  const availableSizes = ['48T', '96T']
  const [selectedSize, setSelectedSize] = useState<string>('96T')

  const sizePrices: Record<string, number | undefined> = {
    '48T': price48t || 1800,
    '96T': price96t || 2400,
  }

  const currentPrice = sizePrices[selectedSize] || 0
  const inStock = stockStatus === 'in_stock'

  return (
    <div className="bg-blue-50 rounded-xl border border-blue-100 p-6 space-y-6">
      {/* Product Info */}
      <div>
        <p className="text-lg font-bold text-slate-900">{name}</p>
        <p className="text-sm text-slate-600 mt-1">货号: {catNo}</p>
        {species && (
          <p className="text-sm text-slate-500 mt-1">种属: {species}</p>
        )}
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
              <span className="text-xs text-slate-400">¥{sizePrices[size]}</span>
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
            下载说明书
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
        <div className="mt-3 space-y-2">
          {/* 联系客服按钮 */}
          <a
             href="weixin://dl/officialaccounts"
             target="_blank"
             rel="noopener noreferrer"
             className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors"
         >
             <MessageSquare className="w-4 h-4" />
             联系客服咨询
           </a>

           {/* 新增提示文字 */}
           <p className="text-center text-xs text-orange-500 font-medium mt-2">
             ⚡ 今天 15:00 前下单，订单将于明天发出
           </p>
         </div>
       </div> 
     </div>
  )
}