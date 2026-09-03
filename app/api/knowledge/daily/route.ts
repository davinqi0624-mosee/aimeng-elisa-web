import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SHORT_PUBLIC_CACHE_HEADERS, getMemoryCached } from '@/lib/server/memory-cache'

type DailyKnowledgeItem = Record<string, unknown> & {
  date?: string
  category?: string | null
}

const FALLBACK_TOPICS = [
  {
    title: '标准曲线不理想怎么办',
    summary: '从标准品复溶、梯度稀释、加样和拟合方式四个方面排查 ELISA 标准曲线异常。',
    category: '标准曲线',
    tags: ['标准曲线', '4PL', '数据分析'],
    content: `## 问题场景
ELISA 标准曲线是样本定量的尺子。如果曲线不平滑、R² 偏低，后续样本浓度反算都会失去可靠性。

## 排查重点
- 标准品是否完全复溶，复溶后是否充分静置
- 梯度稀释是否逐级混匀，是否更换枪头
- 加样顺序是否固定，复孔差异是否过大
- 是否优先使用 4PL 拟合，并检查两端标准点`,
  },
  {
    title: 'OD值异常排查指南',
    summary: 'OD 值过高、过低或复孔差异大时，可以从样本、洗板、显色和仪器四个环节排查。',
    category: 'Troubleshooting',
    tags: ['OD值', '异常排查', 'ELISA'],
    content: `## 问题场景
OD 值异常会直接影响 ELISA 结果判读。常见表现包括整板偏高、整板偏低、边缘孔异常或复孔差异明显。

## 原因解析
- 整板偏高：洗板不充分、抗体浓度过高、显色过度
- 整板偏低：试剂失活、孵育不足、样本浓度过低
- 复孔差异大：加样误差、气泡、孔底残液不一致
- 边缘效应：孵育温度不均或封板不严`,
  },
  {
    title: '样本稀释倍数怎么定',
    summary: '样本 OD 最好落在标准曲线中段，过高或过低都需要调整稀释倍数后复测。',
    category: '样本处理',
    tags: ['样本稀释', '定量范围', '复测'],
    content: `## 问题场景
ELISA 样本浓度未知时，若 OD 超出标准曲线范围，反算结果就不可靠。

## 操作步骤
1. 先做预实验或参考文献确定大致浓度范围
2. 高浓度样本设置多个稀释梯度
3. 选择落在曲线中段的稀释倍数计算最终浓度
4. 最终浓度 = 反算浓度 × 稀释倍数`,
  },
  {
    title: '复孔CV值超标处理',
    summary: '复孔 CV% 是判断实验稳定性的重要指标，超标时应优先检查加样、洗板和孔内气泡。',
    category: '操作技巧',
    tags: ['复孔', 'CV', '加样误差'],
    content: `## 问题场景
同一样本的两个复孔 OD 差异过大，会导致均值失真，影响浓度反算。

## 操作建议
- 加样前预润湿枪头
- 同一样本复孔连续加样
- 读板前检查气泡
- 洗板后统一拍干力度`,
  },
  {
    title: '洗板步骤为什么关键',
    summary: '洗板决定背景值和重复性，洗不干净会高背景，洗得过猛也可能损失结合物。',
    category: '操作技巧',
    tags: ['洗板', '背景值', '重复性'],
    content: `## 问题场景
ELISA 中许多高背景、重复性差的问题，都和洗板有关。

## 操作建议
- 每孔洗液体积建议不少于 300 μL
- 每次洗涤后充分吸尽残液
- 手工洗板时保持加液和拍干一致
- 洗板机需定期检查针头堵塞`,
  },
]

function shanghaiTodayParts() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  return Object.fromEntries(parts.map((part) => [part.type, part.value]))
}

function currentMonthDates() {
  const parts = shanghaiTodayParts()
  const day = Number(parts.day)

  return Array.from({ length: day }, (_, index) => {
    const date = String(index + 1).padStart(2, '0')
    return `${parts.year}-${parts.month}-${date}`
  })
}

function fallbackArticle(date: string, index: number) {
  const topic = FALLBACK_TOPICS[index % FALLBACK_TOPICS.length]

  return {
    id: `fallback-${date}`,
    title: topic.title,
    summary: topic.summary,
    content: topic.content,
    tag: null,
    cover_image: null,
    publish_date: date,
    is_published: true,
    view_count: 0,
    like_count: 0,
    created_at: `${date}T00:00:00.000Z`,
    updated_at: `${date}T00:00:00.000Z`,
    quality_score: 0.72,
    source_type: 'system_fallback',
    lifecycle_status: 'active',
    helpful_count: 0,
    not_helpful_count: 0,
    expires_at: null,
    is_featured: false,
    category: topic.category,
    tags: topic.tags,
    is_hot: false,
    date,
    knowledge_versions: [{ count: 0 }],
    is_fallback: true,
  }
}

function withCurrentMonthFallback(data: DailyKnowledgeItem[], category: string | null) {
  const existingDates = new Set(data.map((item) => item?.date).filter(Boolean))
  const fallbackItems = currentMonthDates()
    .filter((date) => !existingDates.has(date))
    .map((date, index) => fallbackArticle(date, index))
    .filter((item) => !category || item.category === category)

  return [...data, ...fallbackItems].sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const all = searchParams.get('all') === 'true'
    const category = searchParams.get('category') || null
    const cacheKey = `api:knowledge-daily:${all ? 'all' : 'month'}:${category || ''}`

    const cached = await getMemoryCached(cacheKey, 2 * 60 * 1000, async () => {
      const supabase = await createClient()

      let query = supabase
        .from('daily_knowledge')
        .select('*, knowledge_versions(count)')
        .eq('lifecycle_status', 'active')

      if (!all) {
        const dates = currentMonthDates()
        const today = dates[dates.length - 1]
        const startOfMonth = dates[0]
        query = query.gte('date', startOfMonth).lte('date', today)
      }

      if (category) {
        query = query.eq('category', category)
      }

      const { data, error } = await query.order('date', { ascending: false })
      if (error) throw error

      return { items: withCurrentMonthFallback((data || []) as DailyKnowledgeItem[], category) }
    })

    return NextResponse.json(cached.value, {
      headers: {
        ...SHORT_PUBLIC_CACHE_HEADERS,
        'X-Aimeng-Cache': cached.hit ? 'hit' : 'miss',
      },
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : '每日知识读取失败' }, { status: 500 })
  }
}
