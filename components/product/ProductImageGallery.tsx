'use client'

import { useState } from 'react'
import Image from 'next/image'

interface GalleryImage {
  url: string
  type: string
  label: string
}

interface ProductImageGalleryProps {
  images: GalleryImage[]
  productName: string
}

const TYPE_LABELS: Record<string, string> = {
  standard_curve: '标准曲线',
  parameters: '实验参数',
  principle: '检测原理',
  validation: '验证数据',
}

export default function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  const safeImages = images.length > 0 ? images : [
    { url: '/images/elisa/elisa_sandwich_lego.jpg', type: 'principle', label: '检测原理' },
  ]

  const activeImage = safeImages[activeIndex]

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative h-80 md:h-96 rounded-xl overflow-hidden border border-slate-200 bg-white">
        <Image
          src={activeImage.url}
          alt={`${productName} - ${activeImage.label}`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 60vw"
          priority
        />
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-4 gap-3">
        {safeImages.map((img, idx) => (
          <button
            key={img.type}
            onClick={() => setActiveIndex(idx)}
            className={`relative aspect-[4/3] rounded-lg overflow-hidden border transition-all ${
              idx === activeIndex
                ? 'border-blue-500 ring-2 ring-blue-500/20'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <Image
              src={img.url}
              alt={img.label}
              fill
              className="object-cover"
              sizes="150px"
            />
            <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] py-1 text-center">
              {TYPE_LABELS[img.type] || img.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
