import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/ai/llm'
import { getAiModelSettings, getProviderForAiTask, type AiProvider } from '@/lib/ai/model-settings'

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function experimentTypeLabel(value: string) {
  const labels: Record<string, string> = {
    elisa: 'ELISA 实验',
    cell: '细胞实验',
    wb: 'WB 实验',
    ihc: 'IHC 实验',
    biochemical: '生化检测实验',
  }
  return labels[value] || value || '实验'
}

function protocolStructure(value: string) {
  const structures: Record<string, string> = {
    elisa: `ELISA 标准 protocol 结构：
1. 实验目的与检测指标确认
2. 样本类型、种属、分组、样本量和稀释策略
3. 试剂盒选择、标准曲线、Blank 和孔板布局
4. 试剂平衡、标准品配制、加样、孵育、洗板、显色和终止
5. 酶标仪读数、4PL 拟合、浓度换算、重复孔 CV 和质控判断
6. 需要客户补充确认的信息`,
    cell: `细胞实验标准 protocol 结构：
1. 实验目的、细胞名称、细胞来源和细胞类型确认
2. 培养基、血清比例、培养条件、传代状态和铺板密度
3. 处理因素、剂量梯度、时间点、阴性/阳性/空白对照和生物学重复
4. 细胞处理、培养、换液、收样、染色或检测终点流程
5. 细胞状态、污染风险、重复数、统计方法和异常排查
6. 需要客户补充确认的信息`,
    wb: `WB 标准 protocol 结构：
1. 实验目的、目标蛋白、分子量、内参和样本来源确认
2. 样本裂解、蛋白提取、蛋白定量、变性和上样量
3. SDS-PAGE 胶浓度、电泳条件、转膜条件和膜类型
4. 封闭、一抗/二抗孵育、洗膜、ECL 或其他显色检测
5. 条带采集、灰度分析、内参归一化、对照设置和失败排查
6. 需要客户补充确认的信息`,
    ihc: `IHC 标准 protocol 结构：
1. 实验目的、组织类型、固定包埋方式和目标抗原确认
2. 切片、脱蜡复水或冰冻切片预处理
3. 抗原修复、内源性酶处理、封闭和非特异背景控制
4. 一抗/二抗孵育、DAB 或荧光显色、复染和封片
5. 阳性/阴性对照、图像采集、评分标准和结果判读
6. 需要客户补充确认的信息`,
    biochemical: `生化检测标准 protocol 结构：
1. 检测指标、样本类型、检测方法和仪器条件确认
2. 样本采集、保存、匀浆/离心/提取等前处理
3. 试剂配制、标准品或质控品设置、重复孔和空白孔
4. 反应体系、孵育条件、检测波长和读数方式
5. 单位换算、蛋白校正、质控判断、异常值和复测建议
6. 需要客户补充确认的信息`,
  }
  return structures[value] || structures.elisa
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const experimentType = clean(body.experimentType) || 'elisa'
    const species = clean(body.species)
    const sampleType = clean(body.sampleType)
    const target = clean(body.target)
    const purpose = clean(body.purpose)
    const sampleCount = clean(body.sampleCount)
    const details = clean(body.details)

    if (!purpose) {
      return NextResponse.json({ error: '缺少实验目的或研究问题' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let matchedProducts: Array<{
      id: string
      name: string
      target: string | null
      detection_range: string | null
      species: string | null
      catalog_number?: string | null
      cat_no?: string | null
    }> = []

    if (target || species) {
      let query = supabase
        .from('products')
        .select('id,name,target,detection_range,species,catalog_number,cat_no')
        .eq('status', 'active')
        .limit(6)

      if (target) {
        query = query.or(`name.ilike.%${target}%,target.ilike.%${target}%,catalog_number.ilike.%${target}%,cat_no.ilike.%${target}%`)
      }
      if (species) {
        query = query.ilike('species', `%${species}%`)
      }

      const { data } = await query
      matchedProducts = data || []
    }

    const productText = matchedProducts.length > 0
      ? matchedProducts
          .map((product, index) =>
            `${index + 1}. ${product.name}；货号：${product.catalog_number || product.cat_no || '待确认'}；靶标：${product.target || '待确认'}；检测范围：${product.detection_range || '待确认'}；种属：${product.species || '待确认'}`
          )
          .join('\n')
      : '当前网站产品库未自动匹配到明确产品。请在方案中说明：如果需要具体货号、库存、报价和说明书，应联系爱萌优宁人工客服确认；不要虚构货号。'

    const aiSettings = await getAiModelSettings({ refresh: true })
    const requestedProvider = getProviderForAiTask(aiSettings, 'protocol')
    let usedProvider: AiProvider = requestedProvider
    let usedModel = ''

    const isElisa = experimentType === 'elisa'
    const systemPrompt = `你是一位资深实验方案设计专家，服务于 AIMENG UNING 爱萌优宁网站客户。你的任务是先根据客户的实验目的设计实验方案，再在合适位置推荐网站产品库中能匹配的产品。

关键原则：
1. 方案逻辑必须从实验目标出发，而不是从某个产品出发。
2. 如果产品库没有明确匹配，不要编造货号、库存、价格或说明书。
3. 如果是 ELISA，要结合 AIMENG UNING ELISA 说明书常见规则：标准曲线 S1-S7 + Blank 共 8 点，推荐标准品和样本做双孔检测，每块板建议单独做标准曲线。
4. 如果是 WB/IHC/细胞实验/生化检测，必须按该实验类型的标准 protocol 结构组织，不要强行套用 ELISA 的样本字段。
5. 客户信息不完整时，不要停在“无法设计”，应先给出可执行的框架方案，再在最后列出必须补充确认的问题。
6. 输出要适合实验人员执行，语言专业、清楚、温和。

当前实验类型应采用的结构：
${protocolStructure(experimentType)}

输出结构：
1. 实验目标理解
2. 推荐实验路线
3. 关键信息整理与缺失项
4. 操作 protocol（按步骤写清楚）
5. 质控与对照设置
6. 数据记录与结果判断
7. 可匹配的 AIMENG UNING 产品建议
8. 风险点与需要客户补充确认的信息`

    const elisaPlateRule = isElisa
      ? `\n\nELISA 孔数计算规则：
- 标准曲线：S1-S7 + Blank，共 8 点。
- 单孔标准曲线 = 8 孔；双孔标准曲线 = 16 孔。
- 样本孔数 = 样本数量 × 平行次数。
- 96T：双孔标准曲线后约可测 80 个样本孔；48T：双孔标准曲线后约可测 32 个样本孔。
- 推荐优先双孔检测，样本 OD 尽量落在标准曲线中段。`
      : ''

    const userPrompt = `客户实验需求：
- 实验类型：${experimentTypeLabel(experimentType)}
- 样本种属：${species || '客户未填写'}
- 样本类型：${sampleType || '客户未填写'}
- 检测指标/目标蛋白：${target || '客户未填写'}
- 样本数量/分组：${sampleCount || '客户未填写'}
- 实验目的：${purpose}
- 客户补充的已知信息：${details || '客户未填写'}

网站产品库自动匹配结果：
${productText}${elisaPlateRule}`

    const protocolContent = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], {
      task: 'protocol',
      provider: requestedProvider,
      temperature: 0.45,
      maxTokens: 4096,
      onProviderUsed: (provider, model) => {
        usedProvider = provider
        usedModel = model
      },
    })

    const ai = {
      provider: usedProvider,
      model: usedModel || undefined,
      fallback_used: usedProvider !== requestedProvider,
    }

    const checklist: string[] = []
    const lines = protocolContent.split('\n')
    let inMaterials = false
    for (const line of lines) {
      if (line.includes('所需材料') || line.includes('试剂清单') || line.includes('准备清单')) {
        inMaterials = true
        continue
      }
      if (inMaterials && (line.match(/^\s*[-*]\s+/) || line.match(/^\s*\d+[.、]/)) && line.length > 5) {
        const item = line.replace(/^\s*[-*]\s+/, '').replace(/^\s*\d+[.、]\s*/, '').trim()
        if (item) checklist.push(item)
      }
      if (inMaterials && (line.includes('样本处理') || line.includes('操作 protocol') || line.includes('实验步骤'))) {
        inMaterials = false
      }
    }

    const titleSuffix = sampleType || species || '实验设计'
    const title = `${target || experimentTypeLabel(experimentType)} 方案 — ${titleSuffix}`
    const primaryProductId = matchedProducts[0]?.id || null

    if (user) {
      try {
        const { data: inserted, error: insertError } = await supabase
          .from('experiments')
          .insert({
            user_id: user.id,
            product_id: primaryProductId,
            sample_type: [species, sampleType].filter(Boolean).join(' / ') || details.slice(0, 120) || experimentTypeLabel(experimentType),
            purpose: `${experimentTypeLabel(experimentType)}；${purpose}`,
            title,
            protocol_content: protocolContent,
            checklist,
          })
          .select('id')
          .single()

        if (!insertError && inserted) {
          return NextResponse.json({ id: inserted.id, title, protocolContent, checklist, ai })
        }
        console.warn('Experiments insert skipped:', insertError?.message)
      } catch (dbErr: unknown) {
        console.warn('Experiments DB unavailable:', getErrorMessage(dbErr, '数据库暂不可用'))
      }
    }

    return NextResponse.json({ id: null, title, protocolContent, checklist, ai })
  } catch (err: unknown) {
    console.error('Experiment generate error:', err)
    const message = getErrorMessage(err, '实验方案生成失败')
    const isAiErr = /DeepSeek|DEEPSEEK|Kimi|KIMI|API_KEY|RATE_LIMIT|INSUFFICIENT/i.test(message)
    return NextResponse.json(
      {
        error: message,
        detail: isAiErr
          ? 'AI API 调用失败，请检查 API Key 和环境变量配置。'
          : '服务器内部错误，请联系管理员。',
      },
      { status: 500 }
    )
  }
}
