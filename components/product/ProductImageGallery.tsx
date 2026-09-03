'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ImageOff } from 'lucide-react'

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
  product_ad: '产品展示',
  standard_curve: '标准曲线',
  method: '检测方法',
  parameters: '实验参数',
  principle: '检测原理',
  validation: '验证数据',
  additional: '其他图片',
  reserved: '预留图片',
}

export default function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set())

  const availableImages = images.filter((image) => !failedUrls.has(image.url))
  const safeImages = availableImages.length > 0 ? availableImages : [
    { url: '/images/elisa/elisa_sandwich_lego.jpg', type: 'principle', label: '检测原理' },
  ]

  const normalizedActiveIndex = Math.min(activeIndex, safeImages.length - 1)
  const activeImage = safeImages[normalizedActiveIndex]

  const markImageFailed = (url: string) => {
    setFailedUrls((prev) => new Set(prev).add(url))
  }

  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative h-80 md:h-96 rounded-xl overflow-hidden border border-slate-200 bg-white">
        {activeImage ? (
          <Image
            src={activeImage.url}
            alt={`${productName} - ${activeImage.label}`}
            fill
            className="object-contain"
            sizes="(max-width: 768px) 100vw, 60vw"
            priority
            onError={() => markImageFailed(activeImage.url)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
            <ImageOff className="h-8 w-8" />
            <span className="text-sm">暂无产品图片</span>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
        {safeImages.map((img, idx) => (
          <button
            key={`${img.type}-${img.url}-${idx}`}
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
              onError={() => markImageFailed(img.url)}
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
