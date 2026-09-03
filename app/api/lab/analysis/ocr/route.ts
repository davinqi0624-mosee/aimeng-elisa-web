import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const MAX_IMAGE_SIZE = 8 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function isMissingOrPlaceholderKey(apiKey: string | undefined) {
  if (!apiKey) return true
  const normalized = apiKey.trim().toLowerCase()
  return (
    normalized === '' ||
    normalized.includes('your-') ||
    normalized.includes('placeholder') ||
    normalized.includes('你复制的key') ||
    normalized === 'sk-你复制的key'
  )
}

function getOcrErrorMessage(error: unknown) {
  const errorRecord = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const nestedError = errorRecord.error && typeof errorRecord.error === 'object' ? errorRecord.error as Record<string, unknown> : {}
  const status = errorRecord.status || errorRecord.code || nestedError.code
  const rawMessage = errorRecord.message || nestedError.message
  const message = typeof rawMessage === 'string' ? rawMessage : ''
  const lower = message.toLowerCase()

  if (status === 429 || message.includes('429') || lower.includes('quota')) {
    return '截图识别额度暂时不足，请稍后再试；也可以先上传 Excel 或把数据复制到文本框。'
  }
  if (status === 401 || message.includes('401') || lower.includes('incorrect api key')) {
    return '截图识别密钥无效或接口地址不匹配，请管理员检查 OPENAI_API_KEY / OPENAI_BASE_URL。'
  }
  if (status === 400 && (lower.includes('image') || lower.includes('vision') || lower.includes('model'))) {
    return '当前 AI 模型不支持图片识别，请管理员更换支持视觉识别的 OPENAI_VISION_MODEL。'
  }
  if (lower.includes('rate limit')) return '截图识别请求过于频繁，请稍后再试。'

  return message || '截图识别失败，请换一张更清晰的截图，或上传 Excel 文件。'
}

function cleanTableText(text: string) {
  return text
    .replace(/^```(?:tsv|csv|text)?\s*/i, '')
    .replace(/```$/i, '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim())
    .join('\n')
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    if (isMissingOrPlaceholderKey(process.env.OPENAI_API_KEY)) {
      return NextResponse.json({ error: '服务器暂未配置 OPENAI_API_KEY，无法进行截图识别。' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: '请先选择或粘贴一张 ELISA 数据截图。' }, { status: 400 })
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: '截图识别仅支持 PNG、JPG、WebP 图片。' }, { status: 400 })
    }

    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json({ error: '截图图片超过 8MB，请裁剪有效表格区域后再上传。' }, { status: 413 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    })

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
      temperature: 0,
      max_tokens: 1800,
      messages: [
        {
          role: 'system',
          content: '你是 ELISA 实验数据录入助手。只根据图片中可见表格提取数据，不要编造，不要解释。',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                '请把截图中的 ELISA 标准品和样本 OD 数据整理成纯文本表格，方便程序继续做 4PL 拟合。\n' +
                '优先输出制表符分隔的宽表，第一行尽量使用：浓度(pg/mL)\\t标准品OD值\\t1#OD值\\t2#OD值。\n' +
                '如果截图是原始孔板表，行名为 A-H，且第一列是标准品 OD（例如 0.0482、0.1782、0.2522、0.3778、0.6057、0.9186、1.4691、2.2160），不要把这些 OD 当作浓度；请自动按 A-H 映射浓度为 0、125、250、500、1000、2000、4000、8000 pg/mL。\n' +
                '例如 A 行应输出：0\\t0.0482\\t0.8333；B 行应输出：125\\t0.1782\\t0.3479。\n' +
                '如果有标准品复孔，请保留为多列，例如：浓度(pg/mL)\\t标准品OD1\\t标准品OD2。\n' +
                '如果有样本 OD，请追加样本列；只输出数字和必要表头。\n' +
                '如果截图不是 ELISA 数据表，或者看不清数字，只输出：无法识别。\n' +
                '不要输出 Markdown，不要输出说明文字。',
            },
            {
              type: 'image_url',
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    })

    const text = cleanTableText(response.choices[0]?.message?.content || '')
    if (!text || text.includes('无法识别')) {
      return NextResponse.json(
        { error: '没有从截图中识别到可用的 ELISA 表格数据，请裁剪到表格区域后重试。' },
        { status: 422 }
      )
    }

    return NextResponse.json({ text })
  } catch (error) {
    console.error('[lab/analysis/ocr]', error)
    return NextResponse.json({ error: getOcrErrorMessage(error) }, { status: 500 })
  }
}
