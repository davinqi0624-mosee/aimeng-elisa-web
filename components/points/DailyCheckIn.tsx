'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, X } from 'lucide-react'

export default function DailyCheckIn({ userId }: { userId?: string }) {
  const checkedUser = useRef<string | null>(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!userId || checkedUser.current === userId) return
    checkedUser.current = userId

    fetch('/api/points/check-in', { method: 'POST' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { awarded?: boolean; message?: string }
        if (response.ok && data.awarded) {
          setMessage(data.message || '今日签到成功，获得 1 积分。')
          window.setTimeout(() => setMessage(''), 4500)
        }
      })
      .catch(() => {
        // 签到不应阻塞页面浏览；用户下次进入仍会再次尝试。
        checkedUser.current = null
      })
  }, [userId])

  if (!message) return null

  return (
    <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm font-medium text-emerald-700 shadow-lg">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>{message}</span>
      <button type="button" onClick={() => setMessage('')} className="ml-2 rounded p-0.5 text-emerald-500 hover:bg-emerald-50" aria-label="关闭签到提示">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
