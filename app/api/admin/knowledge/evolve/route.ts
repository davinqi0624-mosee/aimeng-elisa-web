import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { chatCompletion } from '@/lib/ai/llm'

const GENERATE_PROMPT = `你是 Animal Union（爱萌优宁）的 ELISA 技术专家。
请基于用户近期经常询问的技术问题，撰写一篇专业、实用、通俗易懂的 ELISA 知识库文章。

要求：
1. 标题简洁有力，20字以内
2. 内容结构清晰：问题场景 → 原理解析 → 操作步骤 → 注意事项
3. 语言风格：专业但亲切，适合科研工作者阅读
4. 必须包含至少一个实用技巧或常见误区提醒
5. 在文章末尾自然植入 Animal Union 试剂盒优势
6. 使用 Markdown 格式，只使用 ## 和 ### 作为标题层级
7. 文章长度 800-1500 字

请返回以下 JSON 格式（不要包含 markdown 代码块标记，直接返回 JSON）：
{
  "title": "文章标题",
  "category": "分类（操作技巧 / Troubleshooting / 产品指南 / 原理解析 / 样本处理 之一）",
  "tags": ["标签1", "标签2", "标签3"],
  "content": "完整的 Markdown 格式文章内容"
}`

// Common stop words to filter out for keyword extraction
const STOP_WORDS = new Set([
  '的', '了', '是', '在', '有', '和', '与', '或', '怎么', '如何', '什么', '请问',
  '为什么', '吗', '呢', '啊', '吧', '可以', '需要', '应该', '能', '会', '要', '做',
  '使用', '进行', '一个', '这个', '那个', '哪个', '一下', '有没有', '多少',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
  'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why',
  'how', 'all', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor',
  'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just',
])

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[？?。.,!！:：;；""''（）()\[\]【】]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
}

function groupBySimilarity(questions: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  const processed = new Set<number>()

  for (let i = 0; i < questions.length; i++) {
    if (processed.has(i)) continue

    const group = [questions[i]]
    processed.add(i)
    const keywordsI = extractKeywords(questions[i])
    if (keywordsI.length === 0) continue

    for (let j = i + 1; j < questions.length; j++) {
      if (processed.has(j)) continue
      const keywordsJ = extractKeywords(questions[j])
      if (keywordsJ.length === 0) continue

      const intersection = keywordsI.filter((k) => keywordsJ.includes(k))
      const union = new Set([...keywordsI, ...keywordsJ])

      // Jaccard similarity > 0.25
      if (intersection.length / union.size > 0.25) {
        group.push(questions[j])
        processed.add(j)
      }
    }

    // Use the longest question as the representative key
    const key = group.reduce((a, b) => (a.length >= b.length ? a : b))
    groups.set(key, group)
  }

  return groups
}

async function runEvolution() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('服务器缺少 SUPABASE_SERVICE_ROLE_KEY')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 1. Query ai_conversations from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: conversations, error: fetchError } = await supabase
    .from('ai_conversations')
    .select('id, question, answer')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })

  if (fetchError) {
    throw new Error(`Fetch error: ${fetchError.message}`)
  }

  if (!conversations || conversations.length === 0) {
    return { message: '过去24小时内没有新的对话记录', generated: 0, topics: [] }
  }

  // 2. Group by similar questions
  const questions = conversations.map((c) => c.question)
  const groups = groupBySimilarity(questions)

  // Sort groups by size (frequency), descending
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)

  // 3. Find top 5 most-asked questions that don't already have answers in knowledge_base
  const topTopics: { question: string; count: number; sampleAnswers: string[] }[] = []

  for (const [representative, groupQuestions] of sortedGroups) {
    if (topTopics.length >= 5) break

    // Check if similar content already exists in knowledge_base
    const keywords = extractKeywords(representative).slice(0, 3).join(' ')
    const { data: existing } = await supabase
      .from('knowledge_base')
      .select('id')
      .or(`title.ilike.%${keywords}%,content.ilike.%${keywords}%`)
      .limit(1)

    if (existing && existing.length > 0) continue

    const sampleAnswers = conversations
      .filter((c) => groupQuestions.includes(c.question))
      .map((c) => c.answer)
      .slice(0, 3)

    topTopics.push({
      question: representative,
      count: groupQuestions.length,
      sampleAnswers,
    })
  }

  if (topTopics.length === 0) {
    return { message: '高频问题均已有对应知识库文章', generated: 0, topics: [] }
  }

  // 4. Generate articles for each topic
  const generatedArticles: any[] = []
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const publishDate = tomorrow.toISOString().split('T')[0]

  for (const topic of topTopics) {
    try {
      const userPrompt = `用户近期经常询问的问题：${topic.question}

该问题在24小时内被询问了 ${topic.count} 次。

以下是从客服对话中提取的参考回答片段：
${topic.sampleAnswers.map((a, i) => `参考${i + 1}：${a.slice(0, 500)}`).join('\n\n')}

请基于以上信息，撰写一篇专业的 ELISA 知识库文章。`

      const aiResponse = await chatCompletion(
        [
          { role: 'system', content: GENERATE_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        { temperature: 0.7, maxTokens: 3000 }
      )

      let article: any
      try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/)
        article = JSON.parse(jsonMatch ? jsonMatch[0] : aiResponse)
      } catch {
        article = {
          title: topic.question.slice(0, 40),
          category: '操作技巧',
          tags: ['ELISA', '自动生成的内容'],
          content: aiResponse,
        }
      }

      // 5. Save to knowledge_base
      const { data: saved, error: insertError } = await supabase
        .from('knowledge_base')
        .insert({
          title: article.title,
          content: article.content,
          source_type: 'ai_evolution',
          category: article.category || 'auto_generated',
          tags: article.tags || ['ELISA', '自动生成的内容'],
          metadata: {
            source: 'ai_evolution',
            generated_from: 'ai_conversations',
            topic_question: topic.question,
            conversation_count: topic.count,
            generated_at: new Date().toISOString(),
          },
          is_published: true,
          publish_date: publishDate,
          view_count: 0,
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[admin/knowledge/evolve] insert error:', insertError.message)
        generatedArticles.push({
          topic: topic.question,
          status: 'insert_error',
          error: insertError.message,
        })
        continue
      }

      generatedArticles.push({
        topic: topic.question,
        status: 'generated',
        article_id: saved.id,
        title: article.title,
      })
    } catch (err: any) {
      console.error('[admin/knowledge/evolve] generation error:', err)
      generatedArticles.push({
        topic: topic.question,
        status: 'generation_error',
        error: err.message,
      })
    }
  }

  return {
    message: '知识进化完成',
    generated: generatedArticles.filter((a) => a.status === 'generated').length,
    topics: generatedArticles,
  }
}

// Vercel Cron invokes GET
export async function GET(request: NextRequest) {
  try {
    const result = await runEvolution()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[admin/knowledge/evolve] GET exception:', err)
    return NextResponse.json({ error: err.message || '知识进化失败' }, { status: 500 })
  }
}

// Manual trigger via POST
export async function POST(request: NextRequest) {
  try {
    const result = await runEvolution()
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[admin/knowledge/evolve] POST exception:', err)
    return NextResponse.json({ error: err.message || '知识进化失败' }, { status: 500 })
  }
}
