'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { renderChatMarkdown } from '@/lib/chat-markdown'
import {
  Send,
  Square,
  ThumbsUp,
  ThumbsDown,
  ShoppingCart,
  Wrench,
  FlaskConical,
  User,
  BookOpen,
  BrainCircuit,
  Mail,
  type LucideIcon,
} from 'lucide-react'

type MessageRole = 'user' | 'assistant'

interface Source {
  id: string
  title: string
  similarity: number
}

interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  sources?: Source[]
  rating?: 'up' | 'down' | null
  isLoading?: boolean
  conversationId?: string | null
  pairedQuestion?: string
  sourceType?: string
}

type ChatMode = 'pre-sales' | 'after-sales' | 'protocol'

const AI_CHAT_BRAIN_BG = '/brand/ai-chat-brain-bg-1600.jpg'
const AI_CHAT_AGENT = '/brand/ai-chat-agent-720.png'
const AI_FEEDBACK_EMAIL = 'aimeng@animaluni.com'

function mailtoHref(email: string, subject: string, body: string) {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function createChatSessionId() {
  return `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const MODE_CONFIG: Record<ChatMode, { label: string; icon: LucideIcon; desc: string; gradient: string }> = {
  'pre-sales': {
    label: '售前咨询',
    icon: ShoppingCart,
    desc: 'ELISA、血清产品选型、价格咨询、货期查询',
    gradient: 'from-blue-500 to-cyan-400',
  },
  'after-sales': {
    label: '售后支持',
    icon: Wrench,
    desc: '实验问题排查、血清使用、技术支持',
    gradient: 'from-emerald-500 to-teal-400',
  },
  protocol: {
    label: '实验方案',
    icon: FlaskConical,
    desc: '实验设计、样本处理、方案优化',
    gradient: 'from-violet-500 to-purple-400',
  },
}

export default function ChatPage() {
  const searchParams = useSearchParams()
  const urlMode = searchParams.get('mode') as ChatMode | null
  const initialMode = urlMode && MODE_CONFIG[urlMode] ? urlMode : 'pre-sales'

  const [mode, setMode] = useState<ChatMode>(initialMode)
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'welcome',
      role: 'assistant',
      content:
        initialMode === 'pre-sales'
          ? '您好！我是 AIMENG UNING 爱萌优宁智能客服助手。请选择上方的服务模式，我可以协助解答 ELISA 试剂盒、胎牛血清、动物血制品、细胞培养、样本处理和常规实验问题。'
          : `已切换到【${MODE_CONFIG[initialMode].label}】模式。${MODE_CONFIG[initialMode].desc}。`,
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSources, setShowSources] = useState<string | null>(null)
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({})
  const [feedbackPending, setFeedbackPending] = useState<Record<string, boolean>>({})
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, string>>({})
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sessionId = useRef<string | null>(null)
  if (sessionId.current === null) {
    sessionId.current = createChatSessionId()
  }

  useEffect(() => {
    if (!urlMode || !MODE_CONFIG[urlMode]) return
    setTimeout(() => {
      setMode((currentMode) => {
        if (currentMode === urlMode) return currentMode
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `已切换到【${MODE_CONFIG[urlMode].label}】模式。${MODE_CONFIG[urlMode].desc}。`,
          },
        ])
        return urlMode
      })
    }, 0)
  }, [urlMode])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: input.trim(),
    }

    const assistantMsg: ChatMessage = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      content: '',
      isLoading: true,
      pairedQuestion: userMsg.content,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInput('')
    setIsLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const history = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          mode,
          sessionId: sessionId.current,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: '请求失败', detail: '' }))
        throw new Error(errorData.error || errorData.detail || '请求失败')
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let sources: Source[] = []
      let conversationId: string | null = null

      const applyStreamData = (data: {
        error?: string
        message?: string
        done?: boolean
        fullText?: string
        text?: string
        sources?: Source[]
        conversationId?: string | null
        sourceType?: string
      }) => {
        if (data.error) {
          fullText = data.message || '抱歉，AI 服务暂时不可用，请稍后再试或联系人工客服。'
        } else if (data.done) {
          fullText = data.fullText || fullText
          conversationId = data.conversationId || conversationId
        } else {
          fullText += data.text || ''
          if (data.sources) sources = data.sources
          conversationId = data.conversationId || conversationId
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? {
                  ...m,
                  content: fullText,
                  isLoading: false,
                  sources,
                  conversationId,
                  sourceType: data.sourceType || m.sourceType,
                }
              : m
          )
        )
      }

      const parseBufferedEvents = (text: string) => {
        const lines = text.split('\n\n')
        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m)
          if (!match) continue
          try {
            applyStreamData(JSON.parse(match[1]))
          } catch {
            // ignore parse errors
          }
        }
      }

      while (reader) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            parseBufferedEvents(buffer)
            buffer = ''
          }
          break
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const match = line.match(/^data: (.+)$/m)
          if (!match) continue
          try {
            applyStreamData(JSON.parse(match[1]))
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err: unknown) {
      if (!(err instanceof Error) || err.name !== 'AbortError') {
        const detail = err instanceof Error ? err.message : ''
        const isApiError = detail.includes('API') || detail.includes('Key') || detail.includes('环境变量')
        const displayMsg = isApiError
          ? `AI 模型调用失败: ${detail}\n\n请检查:\n1. 服务器环境变量中的模型 API Key 是否已配置\n2. API Key 是否有效\n3. 后台 AI 模型设置是否选择了可用模型`
          : `抱歉，服务暂时不可用: ${detail}`
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: displayMsg, isLoading: false }
              : m
          )
        )
      }
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
  }, [input, isLoading, messages, mode])

  const handleStop = () => {
    abortRef.current?.abort()
    setIsLoading(false)
    setMessages((prev) =>
      prev.map((m) => (m.isLoading ? { ...m, isLoading: false } : m))
    )
  }

  const submitFeedback = useCallback(async (msgId: string, rating: 'up' | 'down') => {
    const targetMessage = messages.find((m) => m.id === msgId)
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating } : m)))

    if (!targetMessage || !targetMessage.content.trim()) {
      setFeedbackStatus((prev) => ({ ...prev, [msgId]: '这条回答还没有生成完整，稍后再提交反馈。' }))
      return
    }

    const correction = rating === 'down' ? (feedbackDrafts[msgId] || '').trim() : ''

    setFeedbackPending((prev) => ({ ...prev, [msgId]: true }))
    setFeedbackStatus((prev) => ({ ...prev, [msgId]: rating === 'up' ? '正在提交反馈...' : '正在提交纠正...' }))

    try {
      const res = await fetch('/api/ai/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: targetMessage.conversationId,
          feedback: rating === 'up' ? 'upvote' : 'downvote',
          correction,
          question: targetMessage.pairedQuestion || '',
          answer: targetMessage.content,
          sourceType: targetMessage.sourceType || 'ai_chat',
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || '反馈提交失败')
      }

      setFeedbackStatus((prev) => ({
        ...prev,
        [msgId]: rating === 'up'
          ? '已记录这条有帮助的回答，并进入后台候选复核。'
          : correction
            ? '已记录纠正内容，并生成待审核知识候选。'
            : '已记录不满意反馈，并生成待复核候选。',
      }))
      if (data.conversationId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msgId ? { ...m, conversationId: data.conversationId } : m))
        )
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : '反馈提交失败'
      setFeedbackStatus((prev) => ({ ...prev, [msgId]: detail }))
    } finally {
      setFeedbackPending((prev) => ({ ...prev, [msgId]: false }))
    }
  }, [feedbackDrafts, messages])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F2F6FA] text-[#1E293B] flex flex-col">
      <style jsx global>{`
        @keyframes ai-agent-talk {
          0%, 100% { transform: translateY(0) scale(1); }
          35% { transform: translateY(-1px) scale(1.018); }
          70% { transform: translateY(1px) scale(0.996); }
        }
        @keyframes ai-mouth-pulse {
          0%, 100% { transform: scaleX(0.82) scaleY(0.52); opacity: 0.45; }
          45% { transform: scaleX(1.18) scaleY(1); opacity: 0.9; }
        }
        @keyframes ai-bubble-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1px); }
        }
        .ai-agent-talking img {
          animation: ai-agent-talk 0.78s ease-in-out infinite;
        }
        .ai-agent-talking .ai-agent-mouth {
          animation: ai-mouth-pulse 0.34s ease-in-out infinite;
        }
        .ai-agent-talking {
          animation: ai-bubble-float 0.78s ease-in-out infinite;
        }
      `}</style>

      <div className="relative overflow-hidden border-b border-white/60 bg-white px-4 py-5 pt-16">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-70"
          style={{ backgroundImage: `url(${AI_CHAT_BRAIN_BG})` }}
        />
        <div className="pointer-events-none absolute inset-0 bg-white/48" />
        <div className="relative mx-auto max-w-5xl">
          <div className="mb-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#08D6FF] via-[#2563EB] to-[#1E1B4B] shadow-[0_14px_34px_rgba(37,99,235,0.38)] ring-1 ring-white/80">
                  <div className="absolute inset-1 rounded-xl bg-white/18" />
                  <BrainCircuit className="relative h-7 w-7 text-white drop-shadow-[0_2px_6px_rgba(255,255,255,0.55)]" />
                </div>
                <h1 className="text-3xl font-black tracking-normal text-[#082A5E] drop-shadow-[0_2px_6px_rgba(255,255,255,0.65)]">
                  RAG AI 智能客服
                </h1>
              </div>
              <p className="mt-3 inline-flex rounded-lg bg-white/75 px-3 py-1.5 text-sm font-semibold text-[#243B5A] shadow-sm ring-1 ring-white/80">
                多模型智能驱动 · ELISA / 血清 / 实验问题咨询
              </p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(MODE_CONFIG) as ChatMode[]).map((m) => {
              const config = MODE_CONFIG[m]
              const Icon = config.icon
              const active = mode === m
              return (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m)
                    setMessages([
                      {
                        id: 'welcome',
                        role: 'assistant',
                        content: `已切换到【${config.label}】模式。${config.desc}。`,
                      },
                    ])
                    setShowSources(null)
                  }}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? `bg-gradient-to-r ${config.gradient} text-white shadow-md`
                      : 'bg-[#F6F8FB] text-[#475569] hover:bg-blue-50 border border-gray-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{config.label}</span>
                </button>
              )
            })}
          </div>
          
          <p className="mt-3 inline-flex rounded-lg bg-white/68 px-3 py-1.5 text-xs font-semibold text-[#334155] shadow-sm ring-1 ring-white/70">
            当前模式：{MODE_CONFIG[mode].label} — {MODE_CONFIG[mode].desc}
          </p>
        </div>
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto bg-[#F2F6FA] px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div
                className={`shrink-0 ${
                  msg.role === 'user'
                    ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600'
                    : `ai-agent-avatar relative h-20 w-16 overflow-visible ${msg.isLoading ? 'ai-agent-talking' : ''}`
                }`}
              >
                {msg.role === 'user' ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <>
                    <Image
                      src={AI_CHAT_AGENT}
                      alt="AI 客服"
                      fill
                      sizes="64px"
                      onError={(event) => {
                        event.currentTarget.style.opacity = '0'
                      }}
                      className="object-contain object-bottom drop-shadow-[0_8px_14px_rgba(14,49,85,0.18)]"
                    />
                    <span
                      className={`ai-agent-mouth absolute left-[52%] top-[21%] h-1.5 w-3 -translate-x-1/2 rounded-full bg-rose-400/75 shadow-sm transition-opacity ${
                        msg.isLoading ? 'opacity-100' : 'opacity-0'
                      }`}
                    />
                  </>
                )}
              </div>
              
              <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-5 py-3.5 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-[#1E293B] rounded-bl-md shadow-sm'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div
                      className="space-y-3 [&_h3]:mt-1 [&_h3]:mb-1 [&_p]:m-0 [&_table]:w-full"
                      dangerouslySetInnerHTML={{ __html: renderChatMarkdown(msg.content) }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  )}
                  {msg.isLoading && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-current animate-pulse rounded-full" />
                  )}
                </div>

                {msg.role === 'assistant' && msg.id !== 'welcome' && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                    {msg.sources && msg.sources.length > 0 && (
                      <button
                        onClick={() => setShowSources(showSources === msg.id ? null : msg.id)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        参考来源 ({msg.sources.length})
                      </button>
                    )}
                    <button
                      onClick={() => void submitFeedback(msg.id, 'up')}
                      disabled={feedbackPending[msg.id]}
                      aria-pressed={msg.rating === 'up'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        msg.rating === 'up'
                          ? 'border-emerald-200 bg-emerald-100 text-emerald-700 shadow-sm'
                          : 'border-transparent text-[#94A3B8] hover:text-[#475569] hover:bg-gray-100'
                      } disabled:opacity-50`}
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void submitFeedback(msg.id, 'down')}
                      disabled={feedbackPending[msg.id]}
                      aria-pressed={msg.rating === 'down'}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        msg.rating === 'down'
                          ? 'border-red-200 bg-red-100 text-red-700 shadow-sm'
                          : 'border-transparent text-[#94A3B8] hover:text-[#475569] hover:bg-gray-100'
                      } disabled:opacity-50`}
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                    </div>
                    {msg.rating === 'down' && (
                      <div className="rounded-xl border border-red-100 bg-red-50/60 p-3 space-y-2">
                        <textarea
                          value={feedbackDrafts[msg.id] || ''}
                          onChange={(e) => setFeedbackDrafts((prev) => ({ ...prev, [msg.id]: e.target.value }))}
                          placeholder="请补充更准确的说法，系统会把这条纠正送去后台审核，后续 AI 可据此持续变专业。"
                          rows={3}
                          className="w-full rounded-lg border border-red-100 bg-white px-3 py-2 text-xs text-[#334155] focus:outline-none focus:ring-2 focus:ring-red-200"
                        />
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => void submitFeedback(msg.id, 'down')}
                            disabled={feedbackPending[msg.id]}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                          >
                            提交纠正
                          </button>
                          <a
                            href={mailtoHref(
                              AI_FEEDBACK_EMAIL,
                              'AI客服回答反馈',
                              [
                                '您好，我想反馈一条 AI 客服回答：',
                                '',
                                `客户问题：${msg.pairedQuestion || '未记录'}`,
                                '',
                                `AI回答：${msg.content}`,
                                '',
                                `我的建议：${feedbackDrafts[msg.id] || ''}`,
                              ].join('\n')
                            )}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            邮件反馈
                          </a>
                          <button
                            onClick={() => {
                              setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, rating: null } : m)))
                              setFeedbackStatus((prev) => ({ ...prev, [msg.id]: '' }))
                            }}
                            disabled={feedbackPending[msg.id]}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-[#475569] transition-colors hover:bg-gray-50 disabled:opacity-50"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                    {feedbackStatus[msg.id] && (
                      <p className="text-xs text-[#64748B]">{feedbackStatus[msg.id]}</p>
                    )}
                  </div>
                )}

                {showSources === msg.id && msg.sources && (
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
                    <div className="text-xs font-semibold text-[#1E293B] flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                      知识库参考
                    </div>
                    {msg.sources.map((s, i) => (
                      <div key={s.id} className="text-xs text-[#475569] flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                          [{i + 1}]
                        </span>
                        <span className="flex-1">{s.title}</span>
                        <span className="text-[#94A3B8]">{(s.similarity * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative border-t border-white/70 bg-white/80 px-4 py-4 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-end gap-3">
          <div className="flex-1">
            <div className="mb-2 text-xs text-[#64748B]">
              AI 会自动沉淀有价值的客户异议和专业补充；点赞/点踩只是帮助后台更快判断优先级。
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`请输入您的问题，例如：${
                mode === 'pre-sales'
                  ? '推荐一款检测小鼠 IL-6 的高灵敏度试剂盒'
                  : mode === 'after-sales'
                  ? '标准曲线线性不好，R²只有0.95，如何优化？'
                  : '如何设计 ELISA 实验方案，样本处理有什么注意事项？'
              }`}
              rows={1}
              className="w-full px-4 py-3 bg-[#F6F8FB] border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          
          {isLoading ? (
            <button
              onClick={handleStop}
              className="px-4 py-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center gap-2 shrink-0"
            >
              <Square className="w-4 h-4 fill-current" />
              <span className="text-sm font-medium">停止</span>
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-3 bg-gradient-to-r from-[#3CB5C0] to-[#2563EB] text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shrink-0 shadow-md"
            >
              <Send className="w-4 h-4" />
              <span className="text-sm font-medium">发送</span>
            </button>
          )}
        </div>
        
        <p className="text-xs text-[#94A3B8] text-center mt-2">
          AI 生成内容仅供参考，实验操作请以实际protocol为准
        </p>
      </div>
    </div>
  )
}
