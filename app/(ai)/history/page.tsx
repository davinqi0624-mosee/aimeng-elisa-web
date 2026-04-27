'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Calendar,
  ChevronRight,
  Loader2,
  AlertCircle,
  Clock,
} from 'lucide-react'

interface Session {
  id: string
  title: string
  mode: string
  created_at: string
  updated_at: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/history')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setSessions(data.sessions)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const selectSession = async (id: string) => {
    setSelectedSession(id)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/ai/history?sessionId=${id}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages(data.messages)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const modeLabel = (m: string) => {
    const map: Record<string, string> = {
      'pre-sales': '售前咨询',
      'after-sales': '售后支持',
      protocol: '实验方案',
    }
    return map[m] || m
  }

  const modeColor = (m: string) => {
    const map: Record<string, string> = {
      'pre-sales': 'bg-blue-50 text-blue-700',
      'after-sales': 'bg-emerald-50 text-emerald-700',
      protocol: 'bg-violet-50 text-violet-700',
    }
    return map[m] || 'bg-gray-50 text-gray-700'
  }

  return (
    <div className="flex h-full">
      {/* Session List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-semibold text-gray-900">历史会话</h1>
        </div>

        {error && (
          <div className="p-3 m-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              <MessageSquare className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>暂无历史会话</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between ${
                    selectedSession === s.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'border-l-4 border-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">{s.title || '未命名会话'}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${modeColor(s.mode)}`}>
                        {modeLabel(s.mode)}
                      </span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(s.updated_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Message Detail */}
      <div className="flex-1 bg-gray-50 overflow-y-auto p-6">
        {!selectedSession ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>选择左侧会话查看详情</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
              <Calendar className="w-4 h-4" />
              <span>{new Date(sessions.find((s) => s.id === selectedSession)?.created_at || '').toLocaleString('zh-CN')}</span>
            </div>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
