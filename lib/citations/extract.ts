import OpenAI from 'openai'
import {
  extractBrandKeywords,
  extractCatalogNumbers,
  normalizeCatalogNumbers,
  normalizeJournalName,
} from './rules'

const MODEL = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini'
const MAX_SCREENSHOT_FILES = 4

export interface CitationExtractionFile {
  fileUrl: string
  fileType: string
  fileName?: string
}

export interface CitationExtractionResult {
  title: string
  authors: string
  affiliation: string
  journal: string
  publication_year: string
  doi: string
  product_cat_no: string[]
  brand_keywords: string[]
  evidence_text: string
  confidence: number
  notes: string
  extraction_status: 'extracted' | 'manual_required' | 'failed'
  matched_if?: number | null
  matched_if_year?: number | null
  matched_if_source?: string | null
}

export function isMissingOrPlaceholderKey(apiKey: string | undefined) {
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

export function getCitationExtractionErrorMessage(error: unknown) {
  const anyError = error as any
  const status = anyError?.status || anyError?.code || anyError?.error?.code
  const message = String(anyError?.message || anyError?.error?.message || '')

  if (status === 429 || message.includes('429') || message.toLowerCase().includes('quota')) {
    return 'AI 文献识别额度暂时不足。文件已经保存，可以提交后由后台管理员人工审核；管理员也可以稍后在额度恢复后重新识别。'
  }

  if (status === 401 || message.includes('401') || message.toLowerCase().includes('incorrect api key')) {
    return 'AI 文献识别密钥无效或接口地址不匹配。文件已经保存，可以先提交等待后台审核；请管理员检查 OPENAI_API_KEY 和 OPENAI_BASE_URL 配置。'
  }

  if (message.includes('OPENAI_API_KEY')) return message
  if (message.toLowerCase().includes('rate limit')) {
    return 'AI 文献识别请求过于频繁，请稍后再试。文件已经保存，可以先提交等待后台审核。'
  }

  return message || 'AI 文献识别暂时失败。文件已经保存，可以提交后由后台管理员人工审核。'
}

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
  return JSON.parse(trimmed)
}

function normalizeExtraction(parsed: any): CitationExtractionResult {
  const evidence = [
    parsed.evidence_text,
    parsed.title,
    parsed.journal,
    parsed.authors,
    parsed.affiliation,
    Array.isArray(parsed.product_cat_no) ? parsed.product_cat_no.join(' ') : parsed.product_cat_no,
    Array.isArray(parsed.brand_keywords) ? parsed.brand_keywords.join(' ') : parsed.brand_keywords,
  ].filter(Boolean).join('\n')

  const products = Array.from(new Set([
    ...(Array.isArray(parsed.product_cat_no) ? parsed.product_cat_no : normalizeCatalogNumbers(parsed.product_cat_no || '')),
    ...extractCatalogNumbers(evidence),
  ].map((x) => String(x).trim().toUpperCase()).filter(Boolean)))

  const brands = Array.from(new Set([
    ...(Array.isArray(parsed.brand_keywords) ? parsed.brand_keywords : []),
    ...extractBrandKeywords(evidence),
  ].map((x) => String(x).trim()).filter(Boolean)))

  const hasCore = Boolean(parsed.title || parsed.journal || products.length || brands.length || parsed.evidence_text)

  return {
    title: parsed.title || '',
    authors: parsed.authors || '',
    affiliation: parsed.affiliation || '',
    journal: parsed.journal || '',
    publication_year: parsed.publication_year ? String(parsed.publication_year) : '',
    doi: parsed.doi || '',
    product_cat_no: products,
    brand_keywords: brands,
    evidence_text: parsed.evidence_text || '',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
    notes: parsed.notes || '',
    extraction_status: hasCore ? 'extracted' : 'manual_required',
  }
}

export async function extractCitationFromFile(params: {
  fileUrl: string
  fileType: string
  fileName?: string
}): Promise<CitationExtractionResult> {
  return extractCitationFromFiles({
    files: [{
      fileUrl: params.fileUrl,
      fileType: params.fileType,
      fileName: params.fileName,
    }],
  })
}

export async function extractCitationFromFiles(params: {
  files: CitationExtractionFile[]
}): Promise<CitationExtractionResult> {
  if (isMissingOrPlaceholderKey(process.env.OPENAI_API_KEY)) {
    throw new Error('服务器暂未配置 OPENAI_API_KEY，无法进行文献智能识别。')
  }

  const files = params.files
    .map((file) => ({
      fileUrl: file.fileUrl.trim(),
      fileType: file.fileType.trim(),
      fileName: file.fileName,
    }))
    .filter((file) => file.fileUrl)

  if (files.length === 0) throw new Error('请先上传文献 PDF 或截图。')

  const pdfFiles = files.filter((file) => file.fileType === 'application/pdf')
  const imageFiles = files.filter((file) => file.fileType.startsWith('image/'))

  if (pdfFiles.length > 0 && files.length > 1) {
    throw new Error('PDF 请单独上传；如果使用截图，请一次选择 2-4 张图片，不要和 PDF 混合上传。')
  }
  if (imageFiles.length !== files.length && pdfFiles.length === 0) {
    throw new Error('仅支持 PDF、PNG、JPG、WebP 文件。')
  }
  if (imageFiles.length > MAX_SCREENSHOT_FILES) {
    throw new Error(`截图最多一次上传 ${MAX_SCREENSHOT_FILES} 张。`)
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  })
  const prompt =
    '请从上传的文献 PDF 或截图中提取：论文标题、作者、发表单位/研究单位、期刊名称、发表年份、DOI、爱萌/Animalunion/Aimeng Uning相关品牌关键词、LV开头产品货号、能证明使用产品的原文证据。截图可能有多张：首页通常包含论文标题/期刊/作者/单位/DOI，材料方法页通常包含产品名称/货号/品牌证据；请综合所有截图合并提取，不要用后面的截图覆盖前面已识别出的标题、期刊和单位。发表单位优先提取通讯作者单位、第一作者单位或主要研究机构，尽量输出简洁机构名称，例如 Shanghai Jiao Tong University；没有看到单位就返回空字符串。只提取文件中能看到的信息，不要编造。JSON字段：title, authors, affiliation, journal, publication_year, doi, product_cat_no(array), brand_keywords(array), evidence_text, confidence(0-1), notes。没有看到就返回空字符串或空数组。'

  if (imageFiles.length > 0) {
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: '你是生物医药企业的文献审核助手。只从图片中可见文字提取信息，不要编造。输出严格 JSON。',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageFiles.map((file) => ({
              type: 'image_url' as const,
              image_url: {
                url: file.fileUrl,
              },
            })),
          ] as any,
        },
      ],
    })

    return normalizeExtraction(extractJson(response.choices[0]?.message?.content || '{}'))
  }

  if (pdfFiles.length === 1) {
    const response = await client.responses.create({
      model: MODEL,
      temperature: 0.1,
      max_output_tokens: 1400,
      text: { format: { type: 'json_object' } },
      input: [
        {
          role: 'system',
          content: '你是生物医药企业的文献审核助手。只从文件中可见文字提取信息，不要编造。输出严格 JSON。',
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_file', file_url: pdfFiles[0].fileUrl },
          ],
        },
      ],
    })

    const text = response.output_text || '{}'
    return normalizeExtraction(extractJson(text))
  }

  throw new Error('仅支持 PDF、PNG、JPG、WebP 文件。')
}

export async function attachJournalIf<T extends { journal?: string }>(
  supabase: any,
  result: T
): Promise<T & { matched_if?: number | null; matched_if_year?: number | null; matched_if_source?: string | null }> {
  const normalized = normalizeJournalName(result.journal || '')
  if (!normalized) return { ...result, matched_if: null, matched_if_year: null, matched_if_source: null }

  const { data } = await supabase
    .from('journal_if_scores')
    .select('impact_factor, jcr_year, source_note')
    .eq('normalized_name', normalized)
    .maybeSingle()

  return {
    ...result,
    matched_if: data?.impact_factor == null ? null : Number(data.impact_factor),
    matched_if_year: data?.jcr_year || null,
    matched_if_source: data?.source_note || null,
  }
}
