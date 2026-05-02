'use client'

import { useEffect, useState } from 'react'
import { useRive, Layout, Fit, Alignment } from '@rive-app/react-canvas'

interface RiveHeroProps {
  src: string
  autoplay?: boolean
  className?: string
  stateMachine?: string
  artboard?: string
  onLoad?: () => void
}

export default function RiveHero({
  src,
  autoplay = true,
  className = '',
  stateMachine,
  artboard,
  onLoad,
}: RiveHeroProps) {
  const [shouldRender, setShouldRender] = useState(true)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mql.matches) {
      setShouldRender(false)
    }

    const handleChange = (e: MediaQueryListEvent) => {
      setShouldRender(!e.matches)
    }
    mql.addEventListener?.('change', handleChange)
    return () => mql.removeEventListener?.('change', handleChange)
  }, [])

  const { RiveComponent } = useRive({
    src,
    autoplay,
    artboard,
    stateMachines: stateMachine ? [stateMachine] : undefined,
    layout: new Layout({ fit: Fit.Cover, alignment: Alignment.Center }),
    onLoad: () => {
      onLoad?.()
    },
  })

  if (!shouldRender || !RiveComponent) {
    return null
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <RiveComponent />
    </div>
  )
}
