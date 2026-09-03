import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/ai/llm'
import { getAiModelSettings, getProviderForAiTask } from '@/lib/ai/model-settings'
import { requireRole } from '@/lib/admin/permissions'

const GENERATE_PROMPT = `你是一位 ELISA 实验技术专家。请根据提供的信息，生成一篇高质量的 ELISA 知识文章。

要求：
1. 标题控制在 15 字以内，吸引人点击
2. 分类必须是以下之一：样本处理、操作技巧、Troubleshooting、前沿文献、产品指南、标准曲线、ELISA原理
3. 摘要 50 字左右，概括核心要点
4. 正文 300-500 字，使用 Markdown 格式（## 标题、- 列表、**加粗**）
5. 必须包含"实操技巧"和"常见误区"两个小节
6. 语言风格：专业但通俗易懂，适合生物实验人员阅读

请严格按以下 JSON 格式输出：
{
  "title": "文章标题",
  "category": "分类",
  "summary": "摘要",
  "content": "正文（Markdown）",
  "tags": ["标签1", "标签2", "标签3"]
}

只输出 JSON，不要其他内容。`

const BATCH_CONCURRENCY = 2
const BATCH_ARTICLE_MAX_TOKENS = 1300

type ProductContextRow = {
  name?: string | null
  target?: string | null
}

type QuestionContextRow = {
  question?: string | null
}

type PaperContextRow = {
  title?: string | null
  journal?: string | null
}

type GeneratedArticle = {
  title?: string
  category?: string
  summary?: string
  content?: string
  tags?: string[]
}

type GeneratedResult =
  | { date: string; status: 'parse_error'; raw: string }
  | { date: string; status: 'insert_error'; error: string }
  | { date: string; status: 'success'; title?: string }

export async function POST(request: NextRequest) {
  const { error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

    const supabase = await createClient()

  try {
    const body = await request.json()
    const { weekOffset = 0 } = body
    const aiSettings = await getAiModelSettings({ refresh: true })
    const longformProvider = getProviderForAiTask(aiSettings, 'longform')

    // Check existing pool
    const { count: existingCount, error: existingError } = await supabase
      .from('daily_knowledge')
      .select('id', { count: 'exact', head: true })
      .eq('lifecycle_status', 'active')
      .gte('date', new Date().toISOString().split('T')[0])

    if (existingError) throw new Error(`检查知识内容池失败: ${existingError.message}`)
    if ((existingCount || 0) >= 7) {
      return NextResponse.json({ message: '内容池充足（已有 7+ 篇）', count: existingCount })
    }

    // Gather context for generation
    const [productData, questionData, paperData] = await Promise.all([
      supabase.from('products').select('name, target, species').limit(3),
      supabase.from('knowledge_candidates').select('question, answer').eq('status', 'pending').limit(3),
      supabase.from('papers').select('title, journal, product_cat_no').eq('upload_status', 'verified').limit(3),
    ])

    const products = productData.data || []
    const questions = questionData.data || []
    const papers = paperData.data || []

    const context = `产品信息：${(products as ProductContextRow[]).map((p) => `${p.name}(${p.target})`).join('、') || 'IL-6 ELISA Kit'}
用户高频问题：${(questions as QuestionContextRow[]).map((q) => q.question).join('；') || '样本溶血怎么办？标准曲线不理想？'}
最新文献：${(papers as PaperContextRow[]).map((p) => `${p.title}(${p.journal})`).join('；') || '近期无新文献'}
`

    const baseDate = new Date()
    baseDate.setDate(baseDate.getDate() + weekOffset * 7)

    const dateSlots = Array.from({ length: 7 }, (_, index) => {
      const articleDate = new Date(baseDate)
      articleDate.setDate(articleDate.getDate() + index)
      return { index, date: articleDate.toISOString().split('T')[0] }
    })

    const existingDates = await Promise.all(
      dateSlots.map(async (slot) => {
        const { data, error } = await supabase
          .from('daily_knowledge')
          .select('id')
          .eq('date', slot.date)
          .maybeSingle()
        if (error) throw new Error(`检查 ${slot.date} 是否已生成失败: ${error.message}`)
        return data?.id ? null : slot
      })
    )

    const pendingSlots = existingDates.filter((slot): slot is { index: number; date: string } => Boolean(slot))
    const generated: GeneratedResult[] = []

    for (let start = 0; start < pendingSlots.length; start += BATCH_CONCURRENCY) {
      const batch = pendingSlots.slice(start, start + BATCH_CONCURRENCY)
      const batchResults = await Promise.all(
        batch.map(async (slot): Promise<GeneratedResult> => {
          try {
            const aiResult = await chatCompletion(
              [
                { role: 'system', content: GENERATE_PROMPT },
                {
                  role: 'user',
                  content: context + `\n请为 ${slot.date} 生成第 ${slot.index + 1} 篇知识文章。要求主题不要和前面重复。`,
                },
              ],
              {
                task: 'longform',
                provider: longformProvider,
                temperature: 0.8,
                maxTokens: BATCH_ARTICLE_MAX_TOKENS,
              }
            )

            let article: GeneratedArticle
            try {
              const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
              article = JSON.parse(jsonMatch ? jsonMatch[0] : aiResult)
            } catch {
              return { date: slot.date, status: 'parse_error', raw: aiResult }
            }

            const { error: insertErr } = await supabase.from('daily_knowledge').insert({
              date: slot.date,
              title: article.title,
              summary: article.summary,
              content: article.content,
              category: article.category,
              tags: article.tags || [],
              quality_score: 0.65,
              source_type: 'ai_generated',
              lifecycle_status: 'active',
              expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            })

            return insertErr
              ? { date: slot.date, status: 'insert_error', error: insertErr.message }
              : { date: slot.date, status: 'success', title: article.title }
          } catch (error: unknown) {
            return {
              date: slot.date,
              status: 'insert_error',
              error: error instanceof Error ? error.message : 'AI 生成失败',
            }
          }
        })
      )
      generated.push(...batchResults)
    }

    return NextResponse.json({
      message: '生成完成',
      generated,
      count: generated.filter((g) => g.status === 'success').length,
      concurrency: BATCH_CONCURRENCY,
    })
  } catch (err: unknown) {
    console.error('[knowledge/auto-generate]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message || '生成失败' : '生成失败' }, { status: 500 })
  }
}
