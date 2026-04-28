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
输出格式要求：
1. 实验目的（1段）
2. 所需材料与试剂（清单形式）
3. 样本处理方案（针对用户提供的样本类型）
4. 实验步骤（编号步骤，详细到每个操作的时间、温度、体积）
5. 标准曲线设计（浓度点设置）
6. 质控方案（阳性对照、阴性对照、空白对照）
7. 预期结果与判定标准
8. 注意事项与常见问题预防
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
