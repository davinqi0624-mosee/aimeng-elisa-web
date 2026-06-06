'use client'

import { useState, useEffect } from 'react'
import DynamicBlocks from './DynamicBlocks'

interface DynamicPageProps {
  pageId: string
  fallback?: React.ReactNode
}

export default function DynamicPage({ pageId, fallback }: DynamicPageProps) {
  const [blocks, setBlocks] = useState<any>(null)
  const [isPublished, setIsPublished] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/pages/${pageId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setBlocks(d.page?.blocks || null)
        setIsPublished(!!d.page?.is_published)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [pageId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const hasContent =
    isPublished &&
    blocks &&
    ((Array.isArray(blocks) && blocks.length > 0) ||
      (typeof blocks === 'object' &&
        !Array.isArray(blocks) &&
        'version' in blocks))

  if (!hasContent) {
    return fallback ? <>{fallback}</> : null
  }

  return <DynamicBlocks blocks={blocks} />
}
