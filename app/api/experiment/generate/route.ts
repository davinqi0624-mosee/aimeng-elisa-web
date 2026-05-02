import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { chatCompletion } from '@/lib/ai/llm'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { productId, sampleType, purpose } = body
    if (!productId || !sampleType || !purpose) {
      return NextResponse.json({ error: '缺少必填参数' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single()

    if (productError) {
      console.error('Product query error:', productError)
      return NextResponse.json({ error: `查询产品失败: ${productError.message}` }, { status: 400 })
    }

    const systemPrompt = `你是一位资深的 ELISA 实验方案设计专家。请根据用户提供的产品信息和实验目的，设计一份详细、可执行的 ELISA 实验方案。

【酶标板孔数计算规则 - 基于 Animal Union 产品说明书】
标准品设计：8 个浓度点（S1-S7 + Blank）
计算公式：总需求孔数 = 标准品孔数 + 空白对照孔 + 样本数 × 样本平行次数
- 标准品孔数：单孔操作 = 8 孔；双孔操作（推荐）= 16 孔
- 空白对照孔：单孔 = 1；双孔（推荐）= 2
- 样本平行：不做平行 ×1；双孔 ×2；三孔 ×3

请在实验方案中：
1. 根据样本数量计算所需酶标板数量（48T/96T）
2. 给出标准曲线浓度点设置（S1-S7 + Blank，共8点）
3. 推荐标准品和样本均做双孔检测
4. 提供孔板布局图（文字描述）

输出格式要求：
1. 实验目的（1段）
2. 所需材料与试剂（清单形式）
3. 样本处理方案（针对用户提供的样本类型）
4. 酶标板孔数计算与布局
5. 实验步骤（编号步骤，详细到每个操作的时间、温度、体积）
6. 标准曲线设计（8点：S1-S7 + Blank）
7. 质控方案（阳性对照、阴性对照、空白对照）
8. 预期结果与判定标准
9. 注意事项与常见问题预防
请使用中文输出，语言严谨专业但易于实验人员执行。`

    const userPrompt = `试剂盒信息：
- 产品名称：${product?.name || '未知'}
- 检测靶标：${product?.target || '未知'}
- 检测范围：${product?.detection_range || '未知'}
- 样本类型：${sampleType}
- 检测目的：${purpose}`

    const protocolContent = await chatCompletion([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], { temperature: 0.6, maxTokens: 4096 })

    // Extract checklist from protocol
    const checklist: string[] = []
    const lines = protocolContent.split('\n')
    let inMaterials = false
    for (const line of lines) {
      if (line.includes('所需材料') || line.includes('试剂清单') || line.includes('准备清单')) {
        inMaterials = true
        continue
      }
      if (inMaterials && line.match(/^\d+\./) && line.length > 5) {
        const item = line.replace(/^\d+\.\s*/, '').trim()
        if (item) checklist.push(item)
      }
      if (inMaterials && (line.includes('样本处理') || line.includes('实验步骤'))) {
        inMaterials = false
      }
    }

    const title = `${product?.target || 'ELISA'} 实验方案 — ${sampleType}`

    // Try to persist to DB; if table missing, gracefully return content directly
    try {
      const { data: inserted, error: insertError } = await supabase
        .from('experiments')
        .insert({
          user_id: user.id,
          product_id: productId,
          sample_type: sampleType,
          purpose,
          title,
          protocol_content: protocolContent,
          checklist,
        })
        .select('id')
        .single()

      if (!insertError && inserted) {
        return NextResponse.json({ id: inserted.id, title, protocolContent, checklist })
      }
      console.warn('Experiments insert skipped:', insertError?.message)
    } catch (dbErr: any) {
      console.warn('Experiments DB unavailable:', dbErr.message)
    }

    return NextResponse.json({ id: null, title, protocolContent, checklist })
  } catch (err: any) {
    console.error('Experiment generate error:', err)
    const isDeepSeekErr = err.message?.includes('DeepSeek') || err.message?.includes('DEEPSEEK')
    return NextResponse.json(
      {
        error: err.message,
        detail: isDeepSeekErr
          ? 'DeepSeek API 调用失败，请检查 API Key 和环境变量配置。'
          : '服务器内部错误，请联系管理员。',
      },
      { status: 500 }
    )
  }
}
