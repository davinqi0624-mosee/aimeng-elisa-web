import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/ai/llm'
import { requireAdminOrSuper } from '@/lib/admin/auth'

type EvolutionResult = {
  needs_update?: boolean
  reason?: string
  change_summary?: string
  updated_content?: string
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

function parseEvolutionResult(text: string): EvolutionResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as EvolutionResult) : null
  } catch {
    return null
  }
}

const EVOLVE_PROMPT = `你是一位 ELISA 技术专家。请审阅下面这篇知识文章，判断其内容是否有过时、遗漏或需要更新的地方。

判断维度：
1. 技术建议是否仍符合当前最佳实践
2. 是否有新的研究发现需要补充
3. 是否有更优的操作方法
4. 内容是否完整，有无遗漏的关键点

如果文章质量良好无需更新，输出：
{"needs_update": false, "reason": "原因"}

如果需要更新，输出：
{
  "needs_update": true,
  "change_summary": "更新摘要",
  "updated_content": "完整的更新后文章正文（Markdown 格式）"
}`

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const cronHeader = request.headers.get('x-cron-secret')
  if (!cronSecret || cronHeader !== cronSecret) {
    const { error: authError } = await requireAdminOrSuper(request)
    if (authError) return authError
  }

  const supabase = await createClient()

  try {
    // Find high-value but old articles (>3 months, quality > 0.7)
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const { data: articles } = await supabase
      .from('daily_knowledge')
      .select('id, title, content, category, quality_score, created_at')
      .eq('lifecycle_status', 'active')
      .gt('quality_score', 0.70)
      .lt('created_at', threeMonthsAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(5)

    if (!articles || articles.length === 0) {
      return NextResponse.json({ message: '暂无需要更新的文章', updated: 0 })
    }

    const results = []
    for (const article of articles) {
      const analysis = await chatCompletion(
        [
          { role: 'system', content: EVOLVE_PROMPT },
          { role: 'user', content: `标题：${article.title}\n\n正文：\n${article.content}` },
        ],
        { task: 'longform', temperature: 0.3 }
      )

      const result = parseEvolutionResult(analysis)
      if (!result) {
        results.push({ id: article.id, title: article.title, status: 'parse_error' })
        continue
      }

      if (!result.needs_update) {
        results.push({ id: article.id, title: article.title, status: 'no_update_needed', reason: result.reason })
        continue
      }

      // Save current version
      const { data: versions } = await supabase
        .from('knowledge_versions')
        .select('version_number')
        .eq('knowledge_id', article.id)
        .order('version_number', { ascending: false })
        .limit(1)

      const nextVersion = (versions?.[0]?.version_number || 0) + 1

      await supabase.from('knowledge_versions').insert({
        knowledge_id: article.id,
        version_number: nextVersion,
        title: article.title,
        content: article.content,
        category: article.category,
        change_type: 'ai_evolve',
        change_summary: result.change_summary || '',
      })

      // Update article
      await supabase.from('daily_knowledge').update({
        content: result.updated_content || article.content,
        quality_score: Math.min(0.95, article.quality_score + 0.02),
      }).eq('id', article.id)

      results.push({
        id: article.id,
        title: article.title,
        status: 'updated',
        version: nextVersion,
        change_summary: result.change_summary || '',
      })
    }

    return NextResponse.json({
      message: '进化完成',
      scanned: articles.length,
      updated: results.filter((r) => r.status === 'updated').length,
      results,
    })
  } catch (err: unknown) {
    console.error('[knowledge/evolve]', err)
    return NextResponse.json({ error: getErrorMessage(err, '进化失败') }, { status: 500 })
  }
}
