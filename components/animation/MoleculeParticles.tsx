'use client'

import { useEffect, useRef } from 'react'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  opacity: number
}

const BRAND_COLORS = [
  '59, 130, 246',   // blue-500
  '16, 185, 129',   // emerald-500
  '168, 85, 247',   // purple-500
]

export default function MoleculeParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number>(0)
  const mouseRef = useRef({ x: -9999, y: -9999 })
  const visibleRef = useRef(true)
  const reducedMotionRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Check reduced motion preference
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mql.matches

    const handleMotionChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches
    }
    mql.addEventListener?.('change', handleMotionChange)

    // IntersectionObserver to pause when offscreen
    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting
      },
      { threshold: 0 }
    )
    observer.observe(canvas)

    const isMobile = window.innerWidth < 768
    const particleCount = isMobile ? 15 : 30

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = parent.clientWidth * dpr
      canvas.height = parent.clientHeight * dpr
      ctx.scale(dpr, dpr)
      canvas.style.width = `${parent.clientWidth}px`
      canvas.style.height = `${parent.clientHeight}px`
    }

    const initParticles = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      particlesRef.current = Array.from({ length: particleCount }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: 1 + Math.random() * 2,
        color: BRAND_COLORS[Math.floor(Math.random() * BRAND_COLORS.length)],
        opacity: 0.3 + Math.random() * 0.3,
      }))
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)

      if (!visibleRef.current || reducedMotionRef.current) {
        // When paused, just clear once and stop drawing
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          ctx.clearRect(0, 0, canvas.width, canvas.height)
        }
        return
      }

      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const particles = particlesRef.current
      const mouse = mouseRef.current

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]

        // Mouse avoidance (gentle repulsion)
        const dx = p.x - mouse.x
        const dy = p.y - mouse.y
        const distMouse = Math.sqrt(dx * dx + dy * dy)
        if (distMouse < 120 && distMouse > 0) {
          const force = (120 - distMouse) / 120 * 0.05
          p.vx += (dx / distMouse) * force
          p.vy += (dy / distMouse) * force
        }

        // Apply velocity damping
        p.vx *= 0.99
        p.vy *= 0.99

        // Keep minimum movement
        if (Math.abs(p.vx) < 0.05) p.vx += (Math.random() - 0.5) * 0.02
        if (Math.abs(p.vy) < 0.05) p.vy += (Math.random() - 0.5) * 0.02

        p.x += p.vx
        p.y += p.vy

        // Wrap around edges
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10

        // Draw particle
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`
        ctx.fill()
      }

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(148, 163, 184, ${0.1 * (1 - dist / 100)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
    }

    resize()
    initParticles()
    rafRef.current = requestAnimationFrame(animate)

    window.addEventListener('resize', resize)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
      mql.removeEventListener?.('change', handleMotionChange)
      observer.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full z-0 pointer-events-auto"
      style={{ display: 'block' }}
    />
  )
}
