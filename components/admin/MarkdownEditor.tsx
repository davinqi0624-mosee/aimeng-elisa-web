'use client'

import { useState } from 'react'
import { Bold, Italic, List, Link, Eye, EyeOff, Heading } from 'lucide-react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-5 mb-3">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">$1</a>')
    .replace(/\n/gim, '<br/>')
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '输入内容...',
  rows = 12,
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false)

  const insertAtCursor = (before: string, after: string = '') => {
    const textarea = document.getElementById('md-editor') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.slice(start, end)
    const newValue = value.slice(0, start) + before + selected + after + value.slice(end)
    onChange(newValue)
    setTimeout(() => {
      textarea.focus()
      const newPos = start + before.length + selected.length
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-200">
        <button
          type="button"
          onClick={() => insertAtCursor('**', '**')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
          title="粗体"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertAtCursor('*', '*')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
          title="斜体"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertAtCursor('## ', '')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
          title="标题"
        >
          <Heading className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertAtCursor('- ', '')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
          title="列表"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => insertAtCursor('[链接文字](', ')')}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 transition-colors"
          title="链接"
        >
          <Link className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setPreview(!preview)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-500 hover:bg-gray-200 transition-colors"
        >
          {preview ? (
            <>
              <EyeOff className="w-3.5 h-3.5" />
              编辑
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              预览
            </>
          )}
        </button>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div
          className="px-4 py-3 text-sm text-gray-700 min-h-[200px] bg-white prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: simpleMarkdownToHtml(value) }}
        />
      ) : (
        <textarea
          id="md-editor"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full px-4 py-3 text-sm text-gray-700 bg-white outline-none resize-y"
        />
      )}
    </div>
  )
}
