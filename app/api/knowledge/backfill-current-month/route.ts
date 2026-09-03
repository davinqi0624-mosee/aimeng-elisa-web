import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TOPICS = [
  {
    title: '标准曲线不理想怎么办',
    category: '标准曲线',
    tags: ['标准曲线', '4PL', '数据分析'],
    summary: '从标准品复溶、梯度稀释、加样和拟合方式四个方面排查 ELISA 标准曲线异常。',
    content: `## 问题场景
ELISA 标准曲线是样本定量的尺子。如果曲线不平滑、R² 偏低，后续样本浓度反算都会失去可靠性。

## 排查重点
- 标准品是否完全复溶，复溶后是否充分静置
- 梯度稀释是否逐级混匀，是否更换枪头
- 加样顺序是否固定，复孔差异是否过大
- 是否优先使用 4PL 拟合，并检查两端标准点

## 实操技巧
建议每个标准点做双孔，复孔 CV% 尽量控制在 15% 以内。若低浓度点波动明显，可检查洗板残液和显色时间。

## 常见误区
不要为了提高 R² 随意删除标准点。删除标准点会缩小定量范围，应先排查实验操作和试剂状态。`,
  },
  {
    title: 'OD值异常排查指南',
    category: 'Troubleshooting',
    tags: ['OD值', '异常排查', 'ELISA'],
    summary: 'OD 值过高、过低或复孔差异大时，可以从样本、洗板、显色和仪器四个环节排查。',
    content: `## 问题场景
OD 值异常会直接影响 ELISA 结果判读。常见表现包括整板偏高、整板偏低、边缘孔异常或复孔差异明显。

## 原因解析
- 整板偏高：洗板不充分、抗体浓度过高、显色过度
- 整板偏低：试剂失活、孵育不足、样本浓度过低
- 复孔差异大：加样误差、气泡、孔底残液不一致
- 边缘效应：孵育温度不均或封板不严

## 操作建议
读取 OD 前检查孔内是否有气泡；洗板后充分拍干但避免孔板过度干燥。显色和终止时间要保持全板一致。

## 常见误区
看到单个孔异常时不要立刻修改数据，应先查看原始孔位、复孔差异和实验记录。`,
  },
  {
    title: '样本稀释倍数怎么定',
    category: '样本处理',
    tags: ['样本稀释', '定量范围', '复测'],
    summary: '样本 OD 最好落在标准曲线中段，过高或过低都需要调整稀释倍数后复测。',
    content: `## 问题场景
ELISA 样本浓度未知时，若 OD 超出标准曲线范围，反算结果就不可靠。

## 原理解析
标准曲线中段通常定量最稳定。高于最高标准点或低于最低标准点的样本，只能提示超范围，不宜直接给出最终浓度。

## 操作步骤
1. 先做预实验或参考文献确定大致浓度范围
2. 高浓度样本设置多个稀释梯度
3. 选择落在曲线中段的稀释倍数计算最终浓度
4. 最终浓度 = 反算浓度 × 稀释倍数

## 常见误区
不要把超出标准曲线范围的样本直接外推计算。外推结果看似有数值，实际误差可能很大。`,
  },
  {
    title: '复孔CV值超标处理',
    category: '操作技巧',
    tags: ['复孔', 'CV', '加样误差'],
    summary: '复孔 CV% 是判断实验稳定性的重要指标，超标时应优先检查加样、洗板和孔内气泡。',
    content: `## 问题场景
同一样本的两个复孔 OD 差异过大，会导致均值失真，影响浓度反算。

## 原因解析
复孔 CV% 超标常见原因包括加样体积不一致、枪头残留、孔内气泡、洗板残液和板条边缘效应。

## 操作建议
- 加样前预润湿枪头
- 同一样本复孔连续加样
- 读板前检查气泡
- 洗板后统一拍干力度

## 常见误区
不能简单取其中一个看起来“更正常”的孔。若复孔差异明显，应结合实验记录决定是否重测。`,
  },
  {
    title: '洗板步骤为什么关键',
    category: '操作技巧',
    tags: ['洗板', '背景值', '重复性'],
    summary: '洗板决定背景值和重复性，洗不干净会高背景，洗得过猛也可能损失结合物。',
    content: `## 问题场景
ELISA 中许多高背景、重复性差的问题，都和洗板有关。

## 原理解析
洗板的目标是去除未结合成分，同时保留特异结合复合物。洗涤不足会提高背景，洗涤过强可能影响信号。

## 操作建议
- 每孔洗液体积建议不少于 300 μL
- 每次洗涤后充分吸尽残液
- 手工洗板时保持加液和拍干一致
- 洗板机需定期检查针头堵塞

## 常见误区
不要认为洗涤次数越多越好。应按说明书要求执行，并保持每次操作一致。`,
  },
]

function articleFor(date: string, index: number) {
  const topic = TOPICS[index % TOPICS.length]
  return {
    date,
    title: topic.title,
    summary: topic.summary,
    content: topic.content,
    category: topic.category,
    tags: topic.tags,
    quality_score: 0.76,
    source_type: 'system_backfill',
    lifecycle_status: 'active',
    is_published: true,
    is_featured: false,
  }
}

function assertCronAllowed(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) return true

  const auth = request.headers.get('authorization')
  const token = request.nextUrl.searchParams.get('token')
  return auth === `Bearer ${secret}` || token === secret
}

export async function GET(request: NextRequest) {
  if (!assertCronAllowed(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Missing Supabase service configuration' }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const start = new Date(year, month, 1)
  const dates: string[] = []

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0])
  }

  const { data: existingDaily, error: dailyError } = await supabase
    .from('daily_knowledge')
    .select('date')
    .in('date', dates)

  if (dailyError) {
    return NextResponse.json({ error: dailyError.message }, { status: 500 })
  }

  const { data: existingBase, error: baseError } = await supabase
    .from('knowledge_base')
    .select('publish_date')
    .in('publish_date', dates)
    .eq('is_published', true)

  if (baseError) {
    return NextResponse.json({ error: baseError.message }, { status: 500 })
  }

  const existing = new Set([
    ...(existingDaily || []).map((item) => item.date),
    ...(existingBase || []).map((item) => item.publish_date),
  ])

  const missingDates = dates.filter((date) => !existing.has(date))
  const inserted: string[] = []
  const errors: Array<{ date: string; error: string }> = []

  for (const [index, date] of missingDates.entries()) {
    const { error } = await supabase.from('daily_knowledge').insert(articleFor(date, index))
    if (error) {
      errors.push({ date, error: error.message })
    } else {
      inserted.push(date)
    }
  }

  return NextResponse.json({
    checked: dates.length,
    existing: existing.size,
    inserted,
    errors,
  })
}

export async function POST(request: NextRequest) {
  return GET(request)
}
