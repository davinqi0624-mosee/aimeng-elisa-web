'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

export default function FeedbackButtons({ knowledgeId }: { knowledgeId: string }) {
  const [voted, setVoted] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleVote(helpful: boolean) {
    if (voted !== null) return
    setLoading(true)
    try {
      await fetch('/api/knowledge/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ knowledge_id: knowledgeId, helpful }),
      })
      setVoted(helpful)
    } catch {
      // ignore
    }
    setLoading(false)
  }

  if (voted !== null) {
    return (
      <span className="text-sm text-green-600">
        {voted ? '感谢你的认可！' : '感谢你的反馈，我们会改进'}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleVote(true)}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-green-50 hover:border-green-200 transition-colors disabled:opacity-50"
      >
        <ThumbsUp className="w-4 h-4" />
        有帮助
      </button>
      <button
        onClick={() => handleVote(false)}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-2 bg-white border rounded-lg text-sm hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
      >
        <ThumbsDown className="w-4 h-4" />
        没帮助
      </button>
    </div>
  )
}
