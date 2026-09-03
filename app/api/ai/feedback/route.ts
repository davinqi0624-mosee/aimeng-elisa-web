import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

// 安全加固：匿名可反馈是产品设计，但必须限流防刷 + 限制输入长度
// （反馈只会进入管理员待审核队列 knowledge_candidates，不直接生效）
const FEEDBACK_RATE_LIMIT = 10
const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000
const feedbackHits = new Map<string, number[]>()

function isFeedbackRateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (feedbackHits.get(ip) || []).filter((t) => now - t < FEEDBACK_RATE_WINDOW_MS)
  if (hits.length >= FEEDBACK_RATE_LIMIT) {
    feedbackHits.set(ip, hits)
    return true
  }
  hits.push(now)
  feedbackHits.set(ip, hits)
  return false
}

const MAX_TEXT_LENGTH = 5000

type FeedbackConversation = {
  id: string
  question: string
  answer: string
  source_type?: string | null
}

export async function POST(request: NextRequest) {
  // 限流：每 IP 每小时最多 10 次反馈
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (isFeedbackRateLimited(clientIp)) {
    return NextResponse.json({ error: '反馈提交过于频繁，请一小时后再试。' }, { status: 429 })
  }

  const body = await request.json()
  const { conversationId, feedback, correction, question, answer, sourceType } = body as {
    conversationId?: string
    feedback?: 'upvote' | 'downvote'
    correction?: string
    question?: string
    answer?: string
    sourceType?: string
  }
  const feedbackNote = typeof correction === 'string' ? correction.trim().slice(0, MAX_TEXT_LENGTH) : ''
  const fallbackQuestion = typeof question === 'string' ? question.trim().slice(0, MAX_TEXT_LENGTH) : ''
  const fallbackAnswer = typeof answer === 'string' ? answer.trim().slice(0, MAX_TEXT_LENGTH) : ''

  if ((!conversationId && (!fallbackQuestion || !fallbackAnswer)) || !feedback || !['upvote', 'downvote'].includes(feedback)) {
    return NextResponse.json({ error: '缺少参数或无效反馈类型' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: '服务器缺少 SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const now = new Date().toISOString()
    let activeConversationId = conversationId || ''

    if (!activeConversationId) {
      const insertPayload = {
        user_id: null,
        question: fallbackQuestion,
        answer: fallbackAnswer,
        source_type: sourceType || 'ai_feedback_fallback',
        products_referenced: [] as string[],
        feedback,
        feedback_at: now,
        ...(feedbackNote ? { feedback_note: feedbackNote } : {}),
      }

      let { data: inserted, error: insertError } = await supabase
        .from('ai_conversations')
        .insert(insertPayload)
        .select('id, question, answer, source_type')
        .single<FeedbackConversation>()

      if (
        insertError &&
        (insertError.message.includes('source_type') ||
          insertError.message.includes('products_referenced') ||
          insertError.message.includes('feedback_at') ||
          insertError.message.includes('feedback_note'))
      ) {
        const fallbackInsert = await supabase
          .from('ai_conversations')
          .insert({
            user_id: null,
            question: fallbackQuestion,
            answer: fallbackAnswer,
            feedback,
          })
          .select('id, question, answer')
          .single<FeedbackConversation>()
        inserted = fallbackInsert.data
        insertError = fallbackInsert.error
      }

      if (insertError || !inserted?.id) {
        console.error('[ai/feedback] fallback conversation insert error:', insertError?.message)
        return NextResponse.json({ error: insertError?.message || '反馈对话保存失败' }, { status: 500 })
      }

      activeConversationId = inserted.id
    }

    const updatePayload: {
      feedback: 'upvote' | 'downvote'
      feedback_at: string
      feedback_note?: string
    } = {
      feedback,
      feedback_at: now,
    }

    if (feedbackNote) {
      updatePayload.feedback_note = feedbackNote
    }

    let { data: conversation, error } = await supabase
      .from('ai_conversations')
      .update(updatePayload)
      .select('id, question, answer, source_type')
      .eq('id', activeConversationId)
      .single<FeedbackConversation>()

    if (error && (error.message.includes('feedback_note') || error.message.includes('feedback_at'))) {
      const fallback = await supabase
        .from('ai_conversations')
        .update({ feedback })
        .select('id, question, answer')
        .eq('id', activeConversationId)
        .single<FeedbackConversation>()
      conversation = fallback.data
      error = fallback.error
    } else if (error && error.message.includes('source_type')) {
      const fallback = await supabase
        .from('ai_conversations')
        .update(updatePayload)
        .select('id, question, answer')
        .eq('id', activeConversationId)
        .single<FeedbackConversation>()
      conversation = fallback.data
      error = fallback.error
    }

    if (error) {
      console.error('[ai/feedback] update error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    let candidateId: string | null = null

    if (conversation) {
      const isHelpful = feedback === 'upvote'
      const candidateAnswer = isHelpful
        ? '客户点赞表示这条 AI 回答有参考价值。建议管理员复核后整理为稳定知识点或标准话术。'
        : feedbackNote || '客户点踩表示这条 AI 回答不满意，但未填写具体纠正内容。建议管理员复核原始问题和回答，判断是否需要补充知识库或优化话术。'
      const candidateContent = [
        '## 原始问题',
        conversation.question,
        '',
        isHelpful ? '## 客户反馈' : feedbackNote ? '## 建议修正' : '## 客户反馈',
        candidateAnswer,
        '',
        '## 原始回答（供审核参考）',
        conversation.answer,
      ].join('\n')
      const candidateSourceType = isHelpful ? 'ai_positive_feedback' : 'ai_feedback'

      const { data: existingCandidate } = await supabase
        .from('knowledge_candidates')
        .select('id')
        .eq('source_conversation_id', conversation.id)
        .eq('source_type', candidateSourceType)
        .limit(1)
        .maybeSingle()

      if (existingCandidate?.id) {
        const { error: updateCandidateError } = await supabase
          .from('knowledge_candidates')
          .update({
            answer: candidateAnswer,
            content: candidateContent,
            category: isHelpful ? '优质回答候选' : feedbackNote ? '待审核补充' : '回答复核',
            tags: isHelpful ? ['AI点赞', '优质回答', '待审核'] : feedbackNote ? ['AI纠错', '用户反馈'] : ['AI点踩', '待复核'],
            ai_quality_score: isHelpful ? 0.72 : feedbackNote ? 0.75 : 0.58,
            ai_extract_reason: isHelpful
              ? '用户点赞了 AI 回答，建议管理员复核是否可整理为正式知识库或标准客服话术。'
              : feedbackNote
              ? '用户对 AI 回答进行了人工补充/纠正，建议管理员审核后纳入知识库。'
              : '用户点踩了 AI 回答但未填写纠正内容，建议管理员复核该回答是否存在错误、遗漏或话术问题。',
            review_note: isHelpful ? '来自 AI 客服点赞优质回答' : feedbackNote ? '来自 AI 客服点踩纠错' : '来自 AI 客服点踩待复核',
          })
          .eq('id', existingCandidate.id)

        if (updateCandidateError) {
          console.error('[ai/feedback] candidate update error:', updateCandidateError.message)
        } else {
          candidateId = existingCandidate.id
        }
      } else {
      const { data: candidate, error: candidateError } = await supabase
        .from('knowledge_candidates')
        .insert({
          source_conversation_id: conversation.id,
          source_type: candidateSourceType,
          question: conversation.question,
          answer: candidateAnswer,
          suggested_title: `${isHelpful ? '优质回答' : feedbackNote ? '纠错' : '待复核'}：${conversation.question.slice(0, 72)}`,
          content: candidateContent,
          category: isHelpful ? '优质回答候选' : feedbackNote ? '待审核补充' : '回答复核',
          tags: isHelpful ? ['AI点赞', '优质回答', '待审核'] : feedbackNote ? ['AI纠错', '用户反馈'] : ['AI点踩', '待复核'],
          ai_quality_score: isHelpful ? 0.72 : feedbackNote ? 0.75 : 0.58,
          ai_extract_reason: isHelpful
            ? '用户点赞了 AI 回答，建议管理员复核是否可整理为正式知识库或标准客服话术。'
            : feedbackNote
            ? '用户对 AI 回答进行了人工补充/纠正，建议管理员审核后纳入知识库。'
            : '用户点踩了 AI 回答但未填写纠正内容，建议管理员复核该回答是否存在错误、遗漏或话术问题。',
          status: 'pending',
          review_note: isHelpful ? '来自 AI 客服点赞优质回答' : feedbackNote ? '来自 AI 客服点踩纠错' : '来自 AI 客服点踩待复核',
        })
        .select('id')
        .single()

      if (candidateError) {
        console.error('[ai/feedback] candidate insert error:', candidateError.message)
      } else {
        candidateId = candidate.id
      }
      }
    }

    return NextResponse.json({ success: true, conversationId: activeConversationId, feedback, candidateId })
  } catch (err: unknown) {
    console.error('[ai/feedback] exception:', err)
    return NextResponse.json({ error: getErrorMessage(err, '提交失败') }, { status: 500 })
  }
}
