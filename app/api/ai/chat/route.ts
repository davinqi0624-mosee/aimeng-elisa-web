import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEmbedding, streamChat } from '@/lib/ai/llm'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

const BRAND_CONSTRAINT = `【角色设定】
你是 Animal Union（爱萌优宁）的官方 AI 智能客服，隶属于上海爱萌优宁生物技术有限公司。
你的唯一职责是帮助客户了解和使用 Animal Union 品牌的产品与服务。

【绝对禁止】
1. 你只能推荐、介绍、引用 Animal Union（爱萌优宁）自家的 ELISA 试剂盒产品。
2. 严禁推荐任何其他品牌的产品，包括但不限于：Abcam、R&D Systems、Elabscience、联科生物、酶联生物、华美生物、四正柏、Raybiotech 等。
3. 严禁在回答中主动提及竞品品牌名称作为"推荐选项"。
4. 如果客户明确要求对比其他品牌，你只能客观说明 Animal Union 的优势，绝不能主动推荐竞品。

【产品推荐策略】
1. 当客户询问"如何选择 X 产品"时：
   - 首先查询 Animal Union 产品库中是否有 X 靶标的试剂盒。
   - 如果有：详细介绍该产品的货号、种属、灵敏度、检测范围、价格。
   - 如果没有：坦诚告知"目前 Animal Union 暂无 X 靶标的试剂盒"，并推荐相近靶标的自家产品。

2. 回答结构模板：
   "根据 Animal Union 产品库，我们为您推荐以下试剂盒：
    - 货号：LVxxxxx
    - 靶标：XXX
    - 适用种属：Human/Mouse/Rat
    - 价格：48T ¥1800 / 96T ¥2400
    [查看详情 →]"

3. 如果用户问的产品我们没有：
   - 回答："Animal Union 目前暂无 X 靶标的试剂盒。我们建议您考虑以下相近产品..."
   - 然后推荐自家检测同一通路/相关因子的产品`

const MODE_PROMPTS: Record<string, string> = {
  'pre-sales': `${BRAND_CONSTRAINT}

你是一位专业的 ELISA 试剂盒售前顾问。你的任务是根据产品知识库，帮助客户选择最适合他们实验需求的试剂盒。
回答风格：专业、友好、条理清晰，适当使用表格对比不同产品。
必须包含的信息：检测指标、样本类型兼容性、灵敏度范围、货期、价格区间建议。
如果不确定某些信息，请明确告知客户需要进一步确认。`,
  'after-sales': `${BRAND_CONSTRAINT}

你是一位经验丰富的 ELISA 技术支持工程师。你的任务是帮助客户解决实验操作中遇到的问题。
回答风格：耐心、细致、步骤化，必要时提供示意图的文字描述。
必须包含的信息：问题原因分析、具体解决步骤、预防措施、是否需要更换试剂盒。
对于复杂问题，建议客户联系技术支持热线或提交工单。`,
  'protocol': `${BRAND_CONSTRAINT}

你是一位 ELISA 实验方案设计专家。你的任务是根据客户的具体实验目的，设计完整的 ELISA 实验方案。
回答风格：严谨、系统、可执行性强。
必须包含的信息：推荐试剂盒型号、样本处理方法、标准曲线设计、质控方案、预期结果范围、注意事项。
如果客户没有提供足够的背景信息，请主动追问关键参数（样本类型、预期浓度范围、检测目的等）。`,
}

async function retrieveKnowledge(query: string, limit: number = 5) {
  const supabase = await createClient()

  try {
    const embedding = await getEmbedding(query)
    const { data, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.5,
      match_count: limit,
    })

    if (error) {
      console.warn('match_knowledge RPC failed, falling back to basic search:', error.message)
      throw error
    }

    return data || []
  } catch (err: any) {
    console.warn('Embedding or vector search failed, falling back to basic search:', err.message)
    const { data: fallback } = await supabase
      .from('knowledge_base')
      .select('id,title,content,category,tags')
      .ilike('content', `%${query.slice(0, 20)}%`)
      .limit(limit)
    return (fallback || []).map((row: any) => ({ ...row, similarity: 0.6 }))
  }
}

async function retrieveProducts(query: string, limit: number = 5) {
  const supabase = await createClient()

  try {
    // Extract potential target keywords from query
    const keywords = query
      .replace(/[？?。.,!！:：;；]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['请问', '什么', '如何', '怎么', '推荐', '哪款', '哪个', '一下', '有没有', '吗', '呢', '的', '了', '是', '和', '与', '或', '在', '有'].includes(w))

    let dbQuery = supabase
      .from('products')
      .select('id, cat_no, name, target, detection_range, sensitivity, price, stock_status, species, slug')
      .eq('status', 'active')
      .limit(limit)

    if (query.toUpperCase().startsWith('LV')) {
      dbQuery = dbQuery.ilike('cat_no', `%${query}%`)
    } else if (keywords.length > 0) {
      const orConditions = keywords
        .map((kw) => `name.ilike.%${kw}%,target.ilike.%${kw}%,cat_no.ilike.%${kw}%`)
        .join(',')
      dbQuery = dbQuery.or(orConditions)
    } else {
      dbQuery = dbQuery.or(`name.ilike.%${query}%,target.ilike.%${query}%`)
    }

    const { data, error } = await dbQuery

    if (error) {
      console.warn('Product search failed:', error.message)
      return []
    }

    return data || []
  } catch (err: any) {
    console.warn('Product retrieval error:', err.message)
    return []
  }
}

export async function POST(request: NextRequest) {
  let query = ''
  try {
    const body = await request.json()
    const { messages, mode = 'pre-sales', sessionId } = body as {
      messages: ChatMessage[]
      mode: string
      sessionId?: string
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 })
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    query = lastUserMessage?.content || ''

    // Retrieve products first (brand constraint enforcement)
    const products = await retrieveProducts(query, 5)
    const productText = products
      .map((p: any, i: number) =>
        `[产品${i + 1}] 货号：${p.cat_no || 'N/A'} | 名称：${p.name} | 靶标：${p.target || 'N/A'} | 种属：${p.species || 'N/A'} | 检测范围：${p.detection_range || 'N/A'} | 灵敏度：${p.sensitivity || 'N/A'} | 价格：${p.price || 'N/A'} | 库存：${p.stock_status === 'in_stock' ? '现货' : '缺货'} | 链接：/products/${p.slug}`
      )
      .join('\n')

    // Retrieve knowledge
    const knowledge = await retrieveKnowledge(query, 5)
    const contextText = knowledge
      .map((k: any, i: number) => `[${i + 1}] ${k.title}\n${k.content.slice(0, 800)}`)
      .join('\n\n')

    const systemPrompt = `${MODE_PROMPTS[mode] || MODE_PROMPTS['pre-sales']}

=== Animal Union 产品库（真实数据）===
${productText || '当前查询未匹配到具体产品。请根据客户问题推荐相近产品，或坦诚告知暂无该产品。'}

=== 知识库参考 ===
${contextText || '暂无相关知识库内容。'}

=== 回答规则 ===
1. 你只能推荐 Animal Union（爱萌优宁）的产品，严禁推荐其他品牌。
2. 如果问题与 ELISA 无关，礼貌地说明你的专业范围。
3. 引用知识库内容时，在文末列出参考来源编号。
4. 回答使用中文。
5. 不要编造不存在的产品信息或参数。`

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10),
    ]

    const responseStream = await streamChat(chatMessages, { temperature: 0.7, maxTokens: 2048 })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = ''
        try {
          for await (const chunk of responseStream) {
            const text = chunk.choices[0]?.delta?.content || ''
            fullText += text
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text, done: false, sources: knowledge.map((k: any) => ({ title: k.title, id: k.id, similarity: k.similarity })) })}
\n\n`
              )
            )
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullText })}\n\n`))
          controller.close()

          // Save to history
          if (sessionId) {
            const supabase = await createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
              await supabase.from('chat_sessions').upsert({
                id: sessionId,
                user_id: user.id,
                mode,
                title: query.slice(0, 50),
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id' })

              await supabase.from('chat_messages').insert([
                {
                  session_id: sessionId,
                  role: 'user',
                  content: query,
                },
                {
                  session_id: sessionId,
                  role: 'assistant',
                  content: fullText,
                  sources: knowledge.map((k: any) => k.id),
                },
              ])
            }
          }
        } catch (e: any) {
          console.error('Stream error:', e)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: `DeepSeek API 流式输出错误: ${e.message}`, done: true })}\n\n`
            )
          )
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('Chat API error:', err)
    return new Response(
      JSON.stringify({
        error: err.message,
        detail: 'DeepSeek API 调用失败，请检查 API Key 和环境变量配置。',
      }),
      { status: 500 }
    )
  }
}
