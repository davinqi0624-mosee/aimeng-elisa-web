import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { chatCompletion } from '@/lib/ai/llm'
import { createAdminClient } from '@/lib/supabase/admin'

type PerformanceCandidate = {
  catalogNumber: string
  name: string
  target: string
  species: string
  detectionRange: string
  sensitivity: string
  source: 'aimeng_product_database' | 'ai_reference_draft'
  confidence: 'verified' | 'needs_review'
  note: string
}

type ProductCandidateRow = {
  catalog_number?: string | null
  cat_no?: string | null
  name?: string | null
  target?: string | null
  species?: string | null
  detection_range?: string | null
  sensitivity?: string | null
  [key: string]: unknown
}

const SPECIES_ALIASES: Record<string, string[]> = {
  human: ['human', '人'],
  mouse: ['mouse', '小鼠'],
  rat: ['rat', '大鼠'],
  rabbit: ['rabbit', '兔'],
  monkey: ['monkey', '猴'],
  canine: ['canine', 'dog', '犬', '狗'],
  dog: ['canine', 'dog', '犬', '狗'],
  porcine: ['porcine', 'pig', '猪'],
  pig: ['porcine', 'pig', '猪'],
  bovine: ['bovine', 'cow', '牛'],
  cow: ['bovine', 'cow', '牛'],
  chicken: ['chicken', '鸡'],
  guineapig: ['guineapig', 'guinea pig', '豚鼠'],
  sheep: ['sheep', '绵羊'],
  zebrafish: ['zebrafish', '斑马鱼'],
}

function normalizeText(value?: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function extractJsonCandidate(raw: string) {
  const withoutFence = raw
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim()
  const firstBrace = withoutFence.indexOf('{')
  const lastBrace = withoutFence.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return withoutFence.slice(firstBrace, lastBrace + 1)
  }
  return withoutFence
}

async function askAiForPerformanceCandidate(target: string, species: string) {
  const raw = await chatCompletion(
    [
      {
        role: 'system',
        content: `你是 ELISA 性能参数候选提取助手。只输出 JSON，不要 Markdown。

严格规则：
1. 只返回检测范围和灵敏度候选。
2. 只能填写纯数值范围/数值 + 单位，例如 "15.6-1000 pg/mL"、"7.8 pg/mL"。
3. 不要加入“常见”“约为”“以实际验证为准”等说明文字。
4. 没有明确数字时填空字符串。
5. 这些只是待人工核验候选，不是爱萌优宁正式确认参数。

JSON 格式：
{
  "candidate_detection_range": "",
  "candidate_sensitivity": ""
}`,
      },
      {
        role: 'user',
        content: `请给出 ${species} ${target} ELISA 试剂盒可能见到的检测范围和灵敏度候选。`,
      },
    ],
    { temperature: 0.1, maxTokens: 300 }
  )

  try {
    return JSON.parse(extractJsonCandidate(raw)) as {
      candidate_detection_range?: string
      candidate_sensitivity?: string
    }
  } catch {
    return {
      candidate_detection_range: extractNumericPerformanceValue(raw, 'range'),
      candidate_sensitivity: extractNumericPerformanceValue(raw, 'single'),
    }
  }
}

function normalizeForSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[αΑ]/g, 'alpha')
    .replace(/[βΒ]/g, 'beta')
    .replace(/[γΓ]/g, 'gamma')
    .replace(/[δΔ]/g, 'delta')
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '')
}

function productMatchesTarget(product: ProductCandidateRow, normalizedTarget: string) {
  const values = [product.target, product.name, product.catalog_number, product.cat_no]
    .map((value) => normalizeForSearch(String(value || '')))
    .filter(Boolean)
  return values.some((value) => value.includes(normalizedTarget) || normalizedTarget.includes(value))
}

function productMatchesSpecies(product: ProductCandidateRow, species: string) {
  const normalizedSpecies = normalizeForSearch(species)
  const speciesAliases = (SPECIES_ALIASES[normalizedSpecies] || [species]).map(normalizeForSearch)
  const values = [product.species, product.name].map((value) => normalizeForSearch(String(value || '')))
  return values.some((value) => speciesAliases.some((alias) => value.includes(alias)))
}

function normalizeUnit(unit?: string) {
  const normalized = normalizeText(unit).replace(/μ/g, 'u')
  if (!normalized) return ''
  if (/^pg/i.test(normalized)) return 'pg/mL'
  if (/^ng/i.test(normalized)) return 'ng/mL'
  if (/^ug|^µg/i.test(normalized)) return 'ug/mL'
  if (/^iu/i.test(normalized)) return 'IU/mL'
  return normalized
}

function extractNumericPerformanceValue(value: unknown, mode: 'range' | 'single') {
  const text = normalizeText(value)
    .replace(/～|~|—|–|至|到/g, '-')
    .replace(/／/g, '/')
    .replace(/毫升/gi, 'mL')
  if (!text) return ''

  const rangeMatch = text.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(pg\/?m[lL]|ng\/?m[lL]|ug\/?m[lL]|µg\/?m[lL]|μg\/?m[lL]|IU\/?m[lL])?/i)
  if (mode === 'range' && rangeMatch) {
    return `${rangeMatch[1]}-${rangeMatch[2]} ${normalizeUnit(rangeMatch[3]) || 'pg/mL'}`.trim()
  }

  const numberMatch = text.match(/(\d+(?:\.\d+)?)\s*(pg\/?m[lL]|ng\/?m[lL]|ug\/?m[lL]|µg\/?m[lL]|μg\/?m[lL]|IU\/?m[lL])?/i)
  if (numberMatch) {
    return `${numberMatch[1]} ${normalizeUnit(numberMatch[2]) || 'pg/mL'}`.trim()
  }

  return ''
}

async function findInternalPerformanceCandidates(target: string, species: string): Promise<PerformanceCandidate[]> {
  try {
    const supabase = createAdminClient()
    const normalizedTarget = normalizeForSearch(target)
    const dbQueryTarget = target.replace(/[(),]/g, ' ').trim()
    const { data, error } = await supabase
      .from('products')
      .select('name,target,species,catalog_number,cat_no,detection_range,sensitivity,status')
      .or(`target.ilike.%${dbQueryTarget}%,name.ilike.%${dbQueryTarget}%,catalog_number.ilike.%${dbQueryTarget}%,cat_no.ilike.%${dbQueryTarget}%`)
      .limit(20)

    if (error) {
      console.warn('[target-intelligence] product lookup skipped:', error.message)
      return []
    }

    return (data || [])
      .filter((product) => productMatchesTarget(product, normalizedTarget))
      .filter((product) => !species || productMatchesSpecies(product, species))
      .filter((product) => normalizeText(product.detection_range) || normalizeText(product.sensitivity))
      .slice(0, 5)
      .map((product) => {
        const detectionRange = extractNumericPerformanceValue(product.detection_range, 'range')
        const sensitivity = extractNumericPerformanceValue(product.sensitivity, 'single')
        return {
          catalogNumber: normalizeText(product.catalog_number) || normalizeText(product.cat_no) || '',
          name: normalizeText(product.name),
          target: normalizeText(product.target),
          species: normalizeText(product.species),
          detectionRange,
          sensitivity,
          source: 'aimeng_product_database' as const,
          confidence: 'verified' as const,
          note: '来自爱萌优宁后台产品数据库，可优先用于说明书参数填充。',
        }
      })
      .filter((product) => product.detectionRange || product.sensitivity)
  } catch (err: unknown) {
    console.warn('[target-intelligence] product lookup unavailable:', err instanceof Error ? err.message : err)
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError } = await requireAdminOrSuper(request)
    if (authError) return authError

    const body = await request.json()
    const target = normalizeText(body.target)
    const species = normalizeText(body.species)
    const direction = normalizeText(body.direction) || 'ELISA说明书简介'

    if (!target) {
      return NextResponse.json({ error: '请先填写靶标名称。' }, { status: 400 })
    }
    if (!species) {
      return NextResponse.json({ error: '请先选择种属。' }, { status: 400 })
    }

    const internalCandidates = await findInternalPerformanceCandidates(target, species)

    const systemPrompt = `你是上海爱萌优宁生物技术有限公司后台使用的“指标信息智能检索 Agent”。

任务：为管理员生成 ELISA 试剂盒说明书中“简介：”区域可用的候选指标简介素材。

严格规则：
1. 只能输出 JSON，不要输出 Markdown。
2. candidate_intro 必须是中文，约 120-220 字，可保留必要英文缩写。
3. candidate_intro 只描述该指标/蛋白/因子的基础生物学功能、常见表达或参与的生理/病理过程。
4. 检测范围和灵敏度只能作为“待核验候选参考”，不得表述为爱萌优宁已确认参数。
5. 不得推荐其他品牌或竞品。
6. 不得声称已经实时访问某个网页或数据库；如需要核验，放入 review_notes。
7. 语言要适合正式产品说明书，克制、专业、不夸大。
8. candidate_detection_range 和 candidate_sensitivity 只能填写纯数值范围/数值 + 单位，例如 "31.2-2000 pg/mL"、"7.8 pg/mL"；不要加入“常见”“约为”“以实际验证为准”等说明文字。没有明确数字时填空字符串。

JSON 格式：
{
  "candidate_intro": "可直接放入说明书简介区域的一段文字",
  "candidate_detection_range": "如有公开常见范围线索可写；没有则为空字符串",
  "candidate_sensitivity": "如有公开常见灵敏度线索可写；没有则为空字符串",
  "key_points": ["要点1", "要点2", "要点3"],
  "review_notes": ["管理员需要人工核验的事项"],
  "confidence": "high | medium | low"
}`

    const userPrompt = `请生成候选指标简介素材：
- 靶标：${target}
- 种属：${species}
- 用途方向：${direction}

请优先让内容适合 ELISA 试剂盒说明书“简介：”区域。`

    const raw = await chatCompletion(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { task: 'datasheet', temperature: 0.25, maxTokens: 1200 }
    )

    let parsed: {
      candidate_intro?: string
      candidate_detection_range?: string
      candidate_sensitivity?: string
      key_points?: string[]
      review_notes?: string[]
      confidence?: string
    }

    try {
      parsed = JSON.parse(extractJsonCandidate(raw))
    } catch {
      parsed = {
        candidate_intro: raw.trim(),
        candidate_detection_range: '',
        candidate_sensitivity: '',
        key_points: [],
        review_notes: ['AI 返回内容不是标准 JSON，采用前请人工核对格式和事实。'],
        confidence: 'low',
      }
    }

    const aiDetectionRange = extractNumericPerformanceValue(parsed.candidate_detection_range, 'range')
    const aiSensitivity = extractNumericPerformanceValue(parsed.candidate_sensitivity, 'single')
    let fallbackPerformance: { candidate_detection_range?: string; candidate_sensitivity?: string } = {}
    if (internalCandidates.length === 0 && !aiDetectionRange && !aiSensitivity) {
      fallbackPerformance = await askAiForPerformanceCandidate(target, species)
    }
    const fallbackDetectionRange = extractNumericPerformanceValue(fallbackPerformance.candidate_detection_range, 'range')
    const fallbackSensitivity = extractNumericPerformanceValue(fallbackPerformance.candidate_sensitivity, 'single')
    const candidateDetectionRange = aiDetectionRange || fallbackDetectionRange
    const candidateSensitivity = aiSensitivity || fallbackSensitivity

    return NextResponse.json({
      target,
      species,
      direction,
      candidateIntro: normalizeText(parsed.candidate_intro),
      performanceCandidates: [
        ...internalCandidates,
        ...(candidateDetectionRange || candidateSensitivity
          ? [{
              catalogNumber: '',
              name: `${species} ${target} 候选参考`,
              target,
              species,
              detectionRange: candidateDetectionRange,
              sensitivity: candidateSensitivity,
              source: 'ai_reference_draft' as const,
              confidence: 'needs_review' as const,
              note: 'AI 候选参考，不可直接作为爱萌优宁正式性能参数；采用前必须人工核验。',
            }]
          : []),
      ],
      keyPoints: Array.isArray(parsed.key_points) ? parsed.key_points.map(normalizeText).filter(Boolean) : [],
      reviewNotes: Array.isArray(parsed.review_notes) ? parsed.review_notes.map(normalizeText).filter(Boolean) : [],
      confidence: ['high', 'medium', 'low'].includes(normalizeText(parsed.confidence))
        ? normalizeText(parsed.confidence)
        : 'medium',
      mode: 'draft_requires_admin_review',
    })
  } catch (err: unknown) {
    console.error('[admin/target-intelligence]', err)
    const message = err instanceof Error ? err.message : '指标信息智能检索失败。'
    const isAiErr = /DeepSeek|DEEPSEEK|Kimi|KIMI|API_KEY|RATE_LIMIT|INSUFFICIENT/i.test(message)
    return NextResponse.json(
      {
        error: message,
        detail: isAiErr
          ? 'AI API 调用失败，请检查 API Key、余额、环境变量和后台模型设置。'
          : '服务器内部错误，请联系管理员。',
      },
      { status: 500 }
    )
  }
}
