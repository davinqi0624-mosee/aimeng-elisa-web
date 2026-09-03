import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/ai/llm'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

type ExtractResult =
  | {
      should_extract: true
      question: string
      answer: string
      suggested_title: string
      category: string
      tags?: string[]
      quality_score?: number
      extract_reason?: string
    }
  | {
      should_extract: false
      reason?: string
    }

const EXTRACT_PROMPT = `你是一个知识提取专家。请分析下面的客服对话，判断其中是否包含可以沉淀为知识库文章的技术问题与解决方案。

判断标准：
1. 必须是一个具体且有复用价值的问题，可以属于 ELISA、胎牛血清/特殊血清、动物血制品、细胞培养、样本处理、实验设计或常规生物实验支持
2. 必须有明确的解决方案或操作建议
3. 内容应该具有通用性，能帮助其他用户
4. 如果对话中包含用户/管理员对 AI 回答的纠正或补充，应优先保留纠正后的专业说法
5. 不要输出竞品推荐，不要把血清问题强行改写成 ELISA 问题

如果符合标准，请输出以下 JSON 格式：
{
  "should_extract": true,
  "question": "用户的核心问题（一句话）",
  "answer": "解决方案的完整描述",
  "suggested_title": "建议的文章标题",
  "category": "样本处理 / 操作技巧 / Troubleshooting / 产品指南 / 血清应用 / 细胞培养 / 实验设计 之一",
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
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { conversation } = body

    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return NextResponse.json({ error: '缺少对话内容' }, { status: 400 })
    }

    // Format conversation for analysis
    const conversationText = conversation
      .map((msg: { role: string; content: string }) => `${msg.role === 'user' ? '用户' : '客服'}: ${msg.content}`)
      .join('\n\n')

    const analysis = await chatCompletion(
      [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: conversationText },
      ],
      { task: 'longform', temperature: 0.3 }
    )

    let result: ExtractResult
    try {
      const jsonMatch = analysis.match(/\{[\s\S]*\}/)
      result = JSON.parse(jsonMatch ? jsonMatch[0] : analysis) as ExtractResult
    } catch {
      return NextResponse.json({
        should_extract: false,
        reason: 'AI 分析结果解析失败',
        raw: analysis,
      })
    }

    if (!result.should_extract) {
      return NextResponse.json(result)
    }

    // Save to candidates
    const { data: candidate, error } = await supabase
      .from('knowledge_candidates')
      .insert({
        source_conversation_id: body.conversationId || null,
        source_type: body.sourceType || 'ai_chat',
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

    if (error) throw error

    return NextResponse.json({
      ...result,
      candidate_id: candidate.id,
    })
  } catch (err: unknown) {
    console.error('[knowledge/extract]', err)
    return NextResponse.json({ error: getErrorMessage(err, '提取失败') }, { status: 500 })
  }
}
