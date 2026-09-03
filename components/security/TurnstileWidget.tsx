'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Script from 'next/script'

type TurnstileWidgetProps = {
  siteKey?: string
  action: string
  onTokenChange: (token: string) => void
  className?: string
}

type TurnstileApi = {
  render: (
    container: string | HTMLElement,
    options: {
      sitekey: string
      action?: string
      callback?: (token: string) => void
      'expired-callback'?: () => void
      'error-callback'?: () => void
    },
  ) => string
  remove?: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

export default function TurnstileWidget({
  siteKey,
  action,
  onTokenChange,
  className = '',
}: TurnstileWidgetProps) {
  const reactId = useId()
  const elementId = `turnstile-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const widgetIdRef = useRef<string | null>(null)
  const [scriptReady, setScriptReady] = useState(false)

  const resetToken = useCallback(() => {
    onTokenChange('')
  }, [onTokenChange])

  useEffect(() => {
    if (!siteKey || !scriptReady || !window.turnstile || widgetIdRef.current) return

    widgetIdRef.current = window.turnstile.render(`#${elementId}`, {
      sitekey: siteKey,
      action,
      callback: onTokenChange,
      'expired-callback': resetToken,
      'error-callback': resetToken,
    })

    return () => {
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current)
      }
      widgetIdRef.current = null
    }
  }, [action, elementId, onTokenChange, resetToken, scriptReady, siteKey])

  if (!siteKey) return null

  return (
    <div className={className}>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />
      <div id={elementId} className="min-h-[65px]" />
    </div>
  )
}
