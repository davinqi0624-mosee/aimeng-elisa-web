'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import MoleculeParticles from './MoleculeParticles'

// Dynamically import RiveHero to avoid loading the runtime on every page
const RiveHero = dynamic(() => import('./RiveHero'), {
  ssr: false,
  loading: () => null,
})

interface HeroBackgroundProps {
  children: React.ReactNode
}

export default function HeroBackground({ children }: HeroBackgroundProps) {
  const [riveLoaded, setRiveLoaded] = useState(false)

  return (
    <section className="relative overflow-hidden bg-white">
      {/* Layer 0: CSS animated gradient (always visible, provides base color) */}
      <div
        className={`absolute inset-0 animate-gradient-flow transition-opacity duration-1000 ${
          riveLoaded ? 'opacity-[0.04]' : 'opacity-[0.07]'
        }`}
      />

      {/* Layer 1: Canvas particle network (atmosphere) */}
      <MoleculeParticles />

      {/* Layer 2: Rive animation (loaded on demand, fades in) */}
      <div className="absolute inset-0 z-[1] pointer-events-none">
        <RiveHero
          src="/rive/hero-particles.riv"
          autoplay
          onLoad={() => setRiveLoaded(true)}
        />
      </div>

      {/* Layer 10: Content */}
      <div className="relative z-10">{children}</div>
    </section>
  )
}
