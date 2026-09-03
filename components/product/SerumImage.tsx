'use client'

import { ImageOff } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

interface SerumImageProps {
  src?: string
  alt: string
  className?: string
  imageClassName?: string
  compact?: boolean
}

function normalizeImageUrl(src?: string) {
  const value = (src || '').trim()
  if (!value) return ''
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/')) return value

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl && value.includes('/')) {
    return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/product-assets/${value.replace(/^\/+/, '')}`
  }

  return value
}

export default function SerumImage({
  src,
  alt,
  className = '',
  imageClassName = '',
  compact = false,
}: SerumImageProps) {
  const [failed, setFailed] = useState(false)
  const imageUrl = normalizeImageUrl(src)
  const showFallback = !imageUrl || failed

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-white ${className}`}>
      {showFallback ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-50 px-4 text-center text-slate-400">
          <ImageOff className={compact ? 'h-5 w-5' : 'h-8 w-8'} />
          <span className={compact ? 'text-xs' : 'text-sm'}>
            {imageUrl ? '图片无法加载' : '暂无产品图片'}
          </span>
        </div>
      ) : (
        <Image
          src={imageUrl}
          alt={alt}
          fill
          sizes={compact ? '160px' : '(max-width: 768px) 100vw, 50vw'}
          className={`object-contain ${imageClassName}`}
          priority={!compact}
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
