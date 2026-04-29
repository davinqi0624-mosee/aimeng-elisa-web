'use client'

import { useState } from 'react'

interface ProductDetailClientProps {
  product: {
    id: string
    name: string
    target: string
    price: number
    detection_range: string
    sensitivity: string
    sample_type: string[]
    stock_status: string
  }
  speciesList: string[]
  aliasList: string[]
}

const SIZE_PRICES: Record<string, number> = {
  '48T': 1800,
  '96T': 2400,
}

export default function ProductDetailClient({
  product,
  speciesList,
  aliasList,
}: ProductDetailClientProps) {
  const availableSizes = ['48T', '96T']
  const [selectedSize, setSelectedSize] = useState<string>('96T')

  const currentPrice = SIZE_PRICES[selectedSize]

  return (
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

      <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>

      {/* 规格选择器 */}
      <div className="mb-6">
        <p className="text-sm font-medium text-gray-700 mb-2">规格选择</p>
        <div className="flex gap-3">
          {availableSizes.map((size) => (
            <button
              key={size}
              onClick={() => setSelectedSize(size)}
              className={`px-5 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                selectedSize === size
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
            >
              {size}
              <span className="ml-1 text-xs text-gray-400">
                ¥{SIZE_PRICES[size]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* 价格 */}
      <p className="text-3xl font-bold text-blue-600 mb-8">
        ¥{currentPrice}
        <span className="text-sm font-normal text-gray-400 ml-2">
          / {selectedSize}
        </span>
      </p>

      {/* 产品参数 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">检测范围</p>
          <p className="font-semibold text-gray-900">{product.detection_range}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-xs text-gray-500 mb-1">灵敏度</p>
          <p className="font-semibold text-gray-900">{product.sensitivity}</p>
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
            {speciesList.join('、')}
          </p>
        </div>
      </div>

      {aliasList.length > 0 && (
        <div className="mb-8">
          <p className="text-sm font-medium text-gray-700 mb-2">常用别名</p>
          <div className="flex flex-wrap gap-2">
            {aliasList.map((a, i) => (
              <span
                key={i}
                className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}

      <button className="w-full sm:w-auto px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors">
        立即咨询
      </button>
    </div>
  )
}
