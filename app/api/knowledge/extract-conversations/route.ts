import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chatCompletion } from '@/lib/ai/llm'

const EXTRACT_PROMPT = `你是一个知识提取专家。请分析下面的客服对话，判断其中是否包含可以沉淀为知识库文章的技术问题与解决方案。

判断标准：
1. 必须是一个具体的 ELISA 实验技术问题
2. 必须有明确的解决方案或操作建议
3. 内容应该具有通用性，能帮助其他用户
4. 回答应该详细、准确，有实用价值

如果符合标准，请输出以下 JSON 格式：
{
  "should_extract": true,
  "question": "用户的核心问题（一句话）",
  "answer": "解决方案的完整描述",
  "suggested_title": "建议的文章标题",
  "category": "样本处理 / 操作技巧 / Troubleshooting / 前沿文献 / 产品指南 之一",
  "tags": ["标签1", "标签2"],
  "quality_score": 0-1 之间的数字（内容越有价值分数越高）,
  "extract_reason": "为什么值得沉淀为知识"
}

如果不符合标准，输出：
{
  "should_extract": false,
  "reason": "不符合的原因"
}

注意：只输出 JSON，不要输出其他内容。`

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: '服务器缺少 SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const body = await request.json()
    const { limit = 20, minAnswerLength = 150 } = body

    // Fetch unprocessed conversations: upvoted OR detailed answers
    const { data: conversations, error: fetchError } = await supabase
      .from('ai_conversations')
      .select('id, question, answer, source_type, products_referenced, feedback')
      .is('extracted_at', null)
      .or(`feedback.eq.upvote,and(feedback.is.null,answer.gte.${minAnswerLength})`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (fetchError) {
      console.error('[extract-conversations] fetch error:', fetchError.message)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!conversations || conversations.length === 0) {
      return NextResponse.json({ message: '暂无待提取的对话', extracted: 0 })
    }

    const results = []
    let extractedCount = 0

    for (const conv of conversations) {
      try {
        const analysis = await chatCompletion(
          [
            { role: 'system', content: EXTRACT_PROMPT },
            {
              role: 'user',
              content: `用户问题：${conv.question}\n\nAI回答：${conv.answer.slice(0, 2000)}`,
            },
          ],
          { temperature: 0.3 }
        )

        let result: any
        try {
          const jsonMatch = analysis.match(/\{[\s\S]*\}/)
          result = JSON.parse(jsonMatch ? jsonMatch[0] : analysis)
        } catch {
          results.push({ id: conv.id, status: 'parse_error' })
          continue
        }

        if (!result.should_extract) {
          results.push({ id: conv.id, status: 'skipped', reason: result.reason })
          // Mark as processed so we don't scan it again
          await supabase
            .from('ai_conversations')
            .update({ extracted_at: new Date().toISOString() })
            .eq('id', conv.id)
          continue
        }

        // Insert into knowledge_candidates
        const { data: candidate, error: insertError } = await supabase
          .from('knowledge_candidates')
          .insert({
            source_conversation_id: conv.id,
            source_type: 'ai_chat',
            question: result.question,
            answer: result.answer,
            suggested_title: result.suggested_title,
            content: `## 问题\n${result.question}\n\n## 解答\n${result.answer}`,
            category: result.category,
            tags: result.tags || [],
            ai_quality_score: result.quality_score || 0.50,
            ai_extract_reason: result.extract_reason,
            status: 'pending',
          })
          .select('id')
          .single()

        if (insertError) {
          results.push({ id: conv.id, status: 'insert_error', error: insertError.message })
          continue
        }

        // Mark conversation as extracted
        await supabase
          .from('ai_conversations')
          .update({ extracted_at: new Date().toISOString() })
          .eq('id', conv.id)

        extractedCount++
        results.push({
          id: conv.id,
          status: 'extracted',
          candidate_id: candidate.id,
          title: result.suggested_title,
        })
      } catch (err: any) {
        results.push({ id: conv.id, status: 'error', error: err.message })
      }
    }

    return NextResponse.json({
      message: '提取完成',
      scanned: conversations.length,
      extracted: extractedCount,
      results,
    })
  } catch (err: any) {
    console.error('[extract-conversations] exception:', err)
    return NextResponse.json({ error: err.message || '提取失败' }, { status: 500 })
  }
}
