import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/ai/llm'
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

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireRole(request, ['super', 'level1', 'level2'])
  if (authError) return authError

  const supabase = await createClient()

  try {
    const body = await request.json()
    const { weekOffset = 0 } = body

    // Check existing pool
    const { data: existing } = await supabase
      .from('daily_knowledge')
      .select('id')
      .eq('lifecycle_status', 'active')
      .gte('date', new Date().toISOString().split('T')[0])
      .limit(1)

    if (existing && existing.length >= 7) {
      return NextResponse.json({ message: '内容池充足（已有 7+ 篇）', count: existing.length })
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

    const context = `产品信息：${products.map((p: any) => `${p.name}(${p.target})`).join('、') || 'IL-6 ELISA Kit'}
用户高频问题：${questions.map((q: any) => q.question).join('；') || '样本溶血怎么办？标准曲线不理想？'}
最新文献：${papers.map((p: any) => `${p.title}(${p.journal})`).join('；') || '近期无新文献'}
`

    const generated: any[] = []
    const baseDate = new Date()
    baseDate.setDate(baseDate.getDate() + weekOffset * 7)

    for (let i = 0; i < 7; i++) {
      const articleDate = new Date(baseDate)
      articleDate.setDate(articleDate.getDate() + i)
      const dateStr = articleDate.toISOString().split('T')[0]

      // Check if date already taken
      const { data: dup } = await supabase
        .from('daily_knowledge')
        .select('id')
        .eq('date', dateStr)
        .maybeSingle()

      if (dup?.id) continue

      const aiResult = await chatCompletion(
        [
          { role: 'system', content: GENERATE_PROMPT },
          { role: 'user', content: context + `\n请为 ${dateStr} 生成第 ${i + 1} 篇知识文章。要求主题不要和前面重复。` },
        ],
        { temperature: 0.8, maxTokens: 2000 }
      )

      let article: any
      try {
        const jsonMatch = aiResult.match(/\{[\s\S]*\}/)
        article = JSON.parse(jsonMatch ? jsonMatch[0] : aiResult)
      } catch {
        generated.push({ date: dateStr, status: 'parse_error', raw: aiResult })
        continue
      }

      const { error: insertErr } = await supabase.from('daily_knowledge').insert({
        date: dateStr,
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

      if (insertErr) {
        generated.push({ date: dateStr, status: 'insert_error', error: insertErr.message })
      } else {
        generated.push({ date: dateStr, status: 'success', title: article.title })
      }
    }

    return NextResponse.json({
      message: '生成完成',
      generated,
      count: generated.filter((g) => g.status === 'success').length,
    })
  } catch (err: any) {
    console.error('[knowledge/auto-generate]', err)
    return NextResponse.json({ error: err.message || '生成失败' }, { status: 500 })
  }
}
