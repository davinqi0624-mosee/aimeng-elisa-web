'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface WeChatCopyProps {
  title: string
  summary: string
  content: string
  category: string
  date: string
  tags: string[]
}

export default function WeChatCopy({ title, summary, content, category, date, tags }: WeChatCopyProps) {
  const [copied, setCopied] = useState(false)

  function generateWeChatText() {
    const formattedDate = new Date(date).toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })

    const cleanContent = content
      .replace(/^##\s+/gm, '## ')
      .replace(/^#\s+/gm, '# ')
      .replace(/^[-*]\s+/gm, '• ')
      .replace(/\*\*(.+?)\*\*/g, '「$1」')
      .replace(/\|.*---.*\|/g, '')
      .replace(/\|/g, ' ')
      .trim()

    const tagStr = tags?.length > 0 ? tags.join(' · ') : category

    return `📌 ${formattedDate} | ELISA 每日一课

━━━━━━━━━━━━━━━

📖 ${title}

${summary}

━━━━━━━━━━━━━━━

${cleanContent}

━━━━━━━━━━━━━━━

💡 想了解更多 ELISA 实验技巧？
访问「爱萌优宁」知识库，每日更新实验干货：
https://aimeng-elisa.com/knowledge/daily

#${tagStr} #ELISA #爱萌优宁
`
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generateWeChatText())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const textarea = document.createElement('textarea')
      textarea.value = generateWeChatText()
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors ${
        copied
          ? 'bg-green-50 text-green-700'
          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
      }`}
    >
      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
      {copied ? '已复制' : '复制公众号文案'}
    </button>
  )
}
