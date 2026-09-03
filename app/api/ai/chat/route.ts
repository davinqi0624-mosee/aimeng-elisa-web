import { NextRequest } from 'next/server'
import { randomUUID } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEmbedding, streamChat } from '@/lib/ai/llm'
import { getAiModelSettings, getProviderForAiTask, type AiProvider } from '@/lib/ai/model-settings'
import { getSerumProductsByCategory } from '@/lib/products/serum-products'
import { buildExactProductSearchValues, buildProductSearchOrConditions, compactSearchTerm, parseProductSearchIntent } from '@/lib/products/search'
import { guardAiDomain } from '@/lib/ai/domain-guard'
import { estimateAiTokens, reserveAiRequest } from '@/lib/security/ai-usage'

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type KnowledgeReference = {
  id: string
  title: string
  content: string
  category?: string | null
  tags?: string[] | null
  similarity?: number
}

type ProductReference = {
  id: string
  cat_no?: string | null
  catalog_number?: string | null
  name?: string | null
  target?: string | null
  detection_range?: string | null
  sensitivity?: string | null
  price?: number | string | null
  stock_status?: string | null
  species?: string | null
  slug?: string | null
}

type SerumProductReference = {
  slug: string
  category: string
  name: string
  english_name?: string | null
  catalog_number?: string | null
  origin?: string | null
  serum_type?: string | null
  package_size?: string | null
  summary?: string | null
  applications?: string[] | null
  quality_items?: Array<{ label: string; value: string }> | null
  cell_applications?: string[] | null
}

type SourceReference = {
  id: string
  title: string
  similarity?: number
}

type OfficialDatasheetReference = {
  id: string
  title: string
  catalog_number?: string | null
  content: Record<string, string>
  updated_at?: string | null
}

type LearningSignal = {
  previousUserQuestion: string
  previousAssistantAnswer: string
}

const CHAT_PRODUCT_LIMIT = 4
const CHAT_SERUM_LIMIT = 4
const CHAT_KNOWLEDGE_LIMIT = 3
const CHAT_DATASHEET_LIMIT = 2
const MAX_DATASHEET_SECTIONS = 3
const MAX_DATASHEET_SECTION_CHARS = 450
const MAX_KNOWLEDGE_SNIPPET_CHARS = 450
const EMBEDDING_RETRY_AFTER_MS = 10 * 60 * 1000

let embeddingDisabledUntil = 0

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message || fallback : fallback
}

function getChatMaxTokens(mode: string) {
  if (mode === 'protocol') return 1500
  if (mode === 'after-sales') return 1200
  return 950
}

function buildOfficialDatasheetContext(docs: OfficialDatasheetReference[]) {
  return docs
    .map((doc, index) => {
      const content = Object.entries(doc.content)
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .slice(0, MAX_DATASHEET_SECTIONS)
        .map(([section, value]) => `【${section}】\n${value.slice(0, MAX_DATASHEET_SECTION_CHARS)}`)
        .join('\n\n')
      return `[官方说明书${index + 1}] ${doc.title}${doc.catalog_number ? ` | 货号：${doc.catalog_number}` : ''}\n${content}`
    })
    .join('\n\n')
}

function isEmbeddingUnsupportedError(message: string) {
  return message.includes('Model "text-embedding-3-small" is not supported') ||
    message.includes('OPENAI_API_KEY_MISSING') ||
    message.includes('OPENAI_EMBED') ||
    message.includes('embeddings')
}

async function basicKnowledgeSearch(
  supabase: SupabaseClient,
  query: string,
  limit: number
): Promise<KnowledgeReference[]> {
  const keyword = query
    .replace(/[？?。.,!！:：;；（）()、]/g, ' ')
    .split(/\s+/)
    .find((word) => word.length >= 2) || query.slice(0, 20)

  const { data: fallback } = await supabase
    .from('knowledge_base')
    .select('id,title,content,category,tags')
    .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
    .limit(limit)
  return ((fallback || []) as KnowledgeReference[]).map((row) => ({ ...row, similarity: 0.6 }))
}

const BRAND_CONSTRAINT = `【角色设定】
你是 AIMENG UNING（爱萌优宁）的官方 AI 智能客服，隶属于上海爱萌优宁生物技术有限公司。
你的职责是帮助客户了解和使用 AIMENG UNING 品牌的产品与服务，并回答与 ELISA、胎牛血清、特殊血清、动物血制品、其他生化检测试剂、细胞培养、样本处理、实验设计和常规生物实验相关的问题。

【绝对禁止】
1. 涉及产品推荐、报价、货号、库存、货期时，只能推荐、介绍、引用 AIMENG UNING（爱萌优宁）自家的产品，包括 ELISA 试剂盒、胎牛血清、特殊血清、动物血制品和其他生化检测试剂。
2. 严禁推荐任何其他品牌的产品，包括但不限于：Abcam、R&D Systems、Elabscience、联科生物、酶联生物、华美生物、四正柏、Raybiotech 等。
3. 严禁在回答中主动提及竞品品牌名称作为"推荐选项"。
4. 如果客户明确要求对比其他品牌，你只能客观说明 AIMENG UNING 的优势，绝不能主动推荐竞品。

【问题范围判断】
1. 如果客户问 ELISA 选型、说明书、标准曲线、孔板计算、样本处理、实验排错：优先围绕 AIMENG UNING ELISA 知识库和产品库回答。
2. 如果客户问胎牛血清、特殊血清、阴性血清、动物血清、动物血制品、COA、批次、细胞培养：优先围绕 AIMENG UNING 血清产品和血清知识回答，不要强行拉回 ELISA。
3. 如果客户问其他生化检测试剂、蛋白免疫印迹 WB、免疫组化 IHC、生化检测、小分子代谢指标或氧化应激指标：先按实验方法、检测指标、样本类型、前处理方式和仪器条件给出选型思路；目前没有明确产品库数据时，不得虚构货号、价格和库存，应建议联系人工客服确认。
4. 如果客户问通用实验问题，例如动物采血、样本采集、保存运输、离心、灭活、无菌操作、细胞培养基础：可以给通用科研建议和操作原则，不要说“我只能回答 ELISA”。但要明确这不是替代机构 SOP、动物伦理委员会、兽医或安全负责人的最终意见。
5. 对动物实验、采血、麻醉、镇静、安乐死、手术等涉及动物福利和安全的问题：只提供高层次原则、风险点和决策依据；提醒必须遵守所在机构 IACUC/动物伦理审批、兽医指导和当地法规。不要提供危险或越权的具体用药剂量。
6. 如果问题明显属于临床诊疗、人体用药或非法操作，礼貌说明不能替代医生/兽医/伦理审批，并给出合规咨询方向。

【产品推荐策略】
1. 当客户询问"如何选择 X 产品"时：
   - 如果是 ELISA/指标/靶标问题：查询 AIMENG UNING ELISA 产品库。
   - 如果是血清/细胞培养/动物血制品问题：查询 AIMENG UNING 血清产品资料。
   - 如果是其他生化检测试剂问题：先确认产品方向（WB / IHC / 生化检测）、检测指标、样本类型、实验方法、仪器条件和是否需要代测；没有正式产品库数据时建议人工确认。
   - 如果有：介绍该产品的货号、规格、适用场景、关键质控信息。
   - 如果没有：坦诚告知"目前 AIMENG UNING 暂无完全匹配的产品"，并建议联系官方客服确认定制或替代方案。

2. 回答结构模板：
   "根据 AIMENG UNING 产品库，我们为您推荐以下试剂盒：
    - 货号：LVxxxxx
    - 靶标：XXX
    - 适用种属：Human/Mouse/Rat
    - 价格：48T ¥1800 / 96T ¥2400
    [查看详情 →]"

3. 如果用户问的产品我们没有：
   - 回答："AIMENG UNING 目前暂无 X 靶标的试剂盒。我们建议您考虑以下相近产品..."
   - 然后推荐自家检测同一通路/相关因子的产品

【酶标板孔数计算规则 - 基于 AIMENG UNING 产品说明书】
标准品设计：
- 8 个浓度点（S1-S7 + Blank）
- 说明书建议：标准品和样本均做双孔检测

计算公式：
先计算样本孔数，再按每块板的真实样本承载量选择 96T/48T 组合。

标准曲线孔数选择：
- 单孔操作：8 孔（S1-S7 各 1 孔 + Blank 1 孔）
- 双孔操作（推荐）：16 孔（S1-S7 各 2 孔 + Blank 2 孔）
- Blank 已包含在 8 点标准曲线中，不要额外再加空白对照孔

样本孔数 = 样本数量 × 样本平行次数
- 不做平行：×1
- 双孔平行：×2
- 三孔平行：×3

每块板都建议重新做标准曲线，所以真实可测样本孔为：
- 96T 可测样本孔 = 96 - 标准曲线孔数
- 48T 可测样本孔 = 48 - 标准曲线孔数
- 单孔标准曲线时：96T 可测 88 个样本孔，48T 可测 40 个样本孔
- 双孔标准曲线时：96T 可测 80 个样本孔，48T 可测 32 个样本孔

推荐原则：
1. 先满足样本孔数。
2. 优先选择板数最少的方案。
3. 在板数相同的情况下，优先选择余量最小、浪费孔最少的 96T/48T 组合。
4. 不要简单用总孔数除以 96T，否则会忽略多块板重复标准曲线造成的真实占孔。

计算示例（双孔推荐方案）：
- 10 样本 + 双孔 + 双孔标准曲线 = 16 + 20 = 36 孔 → 1 块 48T
- 30 样本 + 双孔 + 双孔标准曲线 = 16 + 60 = 76 孔 → 1 块 96T
- 50 样本 + 双孔样本 + 双孔标准曲线：样本孔 100；96T 实际可测 80 个样本孔，48T 实际可测 32 个样本孔 → 1 块 96T + 1 块 48T
- 91 样本 + 不做平行 + 单孔标准曲线：96T 实际可测 88 个样本孔，48T 实际可测 40 个样本孔 → 1 块 96T + 1 块 48T
- 180 样本 + 不做平行 + 单孔标准曲线：2 块 96T 只能测 176 个样本孔，不够；推荐 2 块 96T + 1 块 48T

客户咨询时的问诊流程：
1. 确认样本总数
2. 确认标准品做单孔还是双孔（推荐双孔）
3. 确认样本做不做平行？几次？
4. 提醒 Blank 已包含在标准曲线内，不额外加孔
5. 按每块板都做标准曲线计算 96T/48T 最优组合，并展示详细过程

【稳定服务骨架】
回答可以自然变化，但遇到产品咨询、选型、实验适配、试用或技术支持类问题时，核心动作必须稳定：
1. 先直接回答客户当前问题，不绕到无关品类；血清问题优先血清，ELISA 问题优先 ELISA。
2. 如果信息不足，主动追问 2-4 个关键背景，不要一次问太多。
   - ELISA：检测指标、样本类型、种属、样本数量、是否复孔、预期浓度或实验目的。
   - 血清/细胞培养：培养细胞类型，是原代细胞还是细胞系，实验用途，是否需要低内毒素/低 IgG/特殊处理，是否关注 COA 或批次稳定性。
3. 如果匹配到 AIMENG UNING 产品，提醒客户可到“产品中心/产品详情页”查看规格、货号、检测范围、灵敏度、COA 或资料下载；不要虚构页面没有的数据。
4. 如果客户在评估血清适配性，可主动说明可以咨询 10ml 小包装/试用装申请，用于批量采购前验证。
5. 如果问题涉及价格、库存、货期、定制、批次锁定、COA 原件或具体货号确认，建议联系人工客服做最终确认。
6. 结尾要有一个温和的下一步：请客户补充关键信息、查看产品详情，或联系人工客服。不要每次机械复制同一句话。
7. 编号必须按 1. 2. 3. 递增，不要所有条目都写成 1.。`

const MODE_PROMPTS: Record<string, string> = {
  'pre-sales': `${BRAND_CONSTRAINT}

你是一位专业的爱萌优宁售前顾问。你的任务是根据产品知识库，帮助客户选择适合他们实验需求的 ELISA 试剂盒、胎牛血清、特殊血清、动物血制品或其他生化检测试剂。
回答风格：专业、友好、条理清晰，适当使用表格对比不同产品。
如为 ELISA 产品：包含检测指标、样本类型兼容性、灵敏度范围、货期、价格区间建议。
如为血清产品：包含血源/产地、规格、适用细胞或应用场景、COA/批次质控关注点。
如果不确定某些信息，请明确告知客户需要进一步确认。`,
  'after-sales': `${BRAND_CONSTRAINT}

你是一位经验丰富的生物实验技术支持工程师。你的任务是帮助客户解决 ELISA、血清使用、细胞培养、样本处理和常规实验操作中遇到的问题。
回答风格：耐心、细致、步骤化，必要时提供示意图的文字描述。
必须包含的信息：问题原因分析、具体排查步骤、预防措施、是否需要更换试剂/血清批次或联系技术支持。
对于复杂问题，建议客户联系技术支持热线或提交工单。`,
  'protocol': `${BRAND_CONSTRAINT}

你是一位生物实验方案设计顾问。你的任务是根据客户的具体实验目的，设计 ELISA 检测、血清选择、细胞培养、样本处理或动物样本采集的合规思路。
回答风格：严谨、系统、可执行性强。
如涉及 ELISA：包含推荐试剂盒型号、样本处理方法、标准曲线设计、质控方案、预期结果范围、注意事项。
如涉及动物样本采集或麻醉：只给原则性建议，强调动物伦理审批、兽医指导、机构 SOP 和动物福利。
如果客户没有提供足够的背景信息，请主动追问关键参数（样本类型、预期浓度范围、检测目的等）。`,
}

async function retrieveKnowledge(query: string, limit: number = 5): Promise<KnowledgeReference[]> {
  const supabase = await createClient()

  if (embeddingDisabledUntil > Date.now()) {
    return basicKnowledgeSearch(supabase, query, limit)
  }

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

    return (data || []) as KnowledgeReference[]
  } catch (err: unknown) {
    const message = getErrorMessage(err, '向量检索失败')
    if (isEmbeddingUnsupportedError(message)) {
      embeddingDisabledUntil = Date.now() + EMBEDDING_RETRY_AFTER_MS
      console.warn('Embedding search unavailable, using basic search for the next 10 minutes:', message)
    } else {
      console.warn('Embedding or vector search failed, falling back to basic search:', message)
    }
    return basicKnowledgeSearch(supabase, query, limit)
  }
}

async function retrieveProducts(query: string, limit: number = 5): Promise<ProductReference[]> {
  const supabase = await createClient()

  try {
    const intent = parseProductSearchIntent(query)
    const searchTerm = intent.catalogLike ? intent.catalogQuery : intent.targetQuery

    if (searchTerm) {
      const exactValues = buildExactProductSearchValues(searchTerm)
      let exactQuery = supabase
        .from('products')
        .select('id, cat_no, catalog_number, name, target, detection_range, sensitivity, price, stock_status, species, slug')
        .eq('status', 'active')
        .limit(limit)

      if (intent.catalogLike) {
        exactQuery = exactQuery.or(`cat_no.in.(${exactValues.join(',')}),catalog_number.in.(${exactValues.join(',')})`)
      } else {
        exactQuery = exactQuery.in('target', exactValues)
      }

      if (intent.speciesQueryValues.length > 0) {
        exactQuery = exactQuery.in('species', intent.speciesQueryValues)
      }
      const { data: exactData, error: exactError } = await exactQuery
      if (!exactError && exactData && exactData.length > 0) {
        return exactData as ProductReference[]
      }
    }

    let dbQuery = supabase
      .from('products')
      .select('id, cat_no, catalog_number, name, target, detection_range, sensitivity, price, stock_status, species, slug')
      .eq('status', 'active')
      .limit(limit)

    if (intent.speciesQueryValues.length > 0) {
      dbQuery = dbQuery.in('species', intent.speciesQueryValues)
    }

    if (compactSearchTerm(searchTerm).toUpperCase().startsWith('LV')) {
      dbQuery = dbQuery.or(buildProductSearchOrConditions(searchTerm, ['cat_no', 'catalog_number']).join(','))
    } else {
      dbQuery = dbQuery.or(buildProductSearchOrConditions(searchTerm, ['name', 'target', 'cat_no']).join(','))
    }

    const { data, error } = await dbQuery

    if (error) {
      console.warn('Product search failed:', error.message)
      return []
    }

    return (data || []) as ProductReference[]
  } catch (err: unknown) {
    console.warn('Product retrieval error:', getErrorMessage(err, '产品检索失败'))
    return []
  }
}

async function retrieveSerumProducts(query: string, limit: number = 5): Promise<SerumProductReference[]> {
  const supabase = await createClient()
  const keywords = query
    .replace(/[？?。.,!！:：;；（）()、]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 2)

  try {
    let dbQuery = supabase
      .from('serum_products')
      .select('slug, category, name, english_name, catalog_number, origin, serum_type, package_size, summary, applications, quality_items, cell_applications')
      .eq('status', 'active')
      .limit(limit)

    if (keywords.length > 0) {
      const orConditions = keywords
        .map((kw) => `name.ilike.%${kw}%,english_name.ilike.%${kw}%,catalog_number.ilike.%${kw}%,summary.ilike.%${kw}%,serum_type.ilike.%${kw}%`)
        .join(',')
      dbQuery = dbQuery.or(orConditions)
    }

    const { data, error } = await dbQuery
    if (!error && data && data.length > 0) return data as SerumProductReference[]
  } catch (err: unknown) {
    console.warn('Serum product retrieval error:', getErrorMessage(err, '血清产品检索失败'))
  }

  const fallback = [
    ...getSerumProductsByCategory('fbs'),
    ...getSerumProductsByCategory('animal-serum'),
  ]
  const normalizedQuery = query.toLowerCase()
  return fallback
    .filter((product) => {
      const haystack = [
        product.name,
        product.englishName,
        product.catalogNumber,
        product.origin,
        product.serumType,
        product.summary,
        ...(product.description || []),
        ...(product.applications || []),
        ...(product.cellApplications || []),
      ].join(' ').toLowerCase()
      return keywords.length === 0
        ? false
        : keywords.some((keyword) => haystack.includes(keyword.toLowerCase()) || normalizedQuery.includes(product.serumType.toLowerCase()))
    })
    .slice(0, limit)
    .map((product) => ({
      slug: product.slug,
      category: product.category,
      name: product.name,
      english_name: product.englishName,
      catalog_number: product.catalogNumber,
      origin: product.origin,
      serum_type: product.serumType,
      package_size: product.packageSize,
      summary: product.summary,
      applications: product.applications,
      quality_items: product.qualityItems,
      cell_applications: product.cellApplications,
    }))
}

async function retrieveOfficialDatasheets(products: ProductReference[], query: string, limit: number = 2): Promise<OfficialDatasheetReference[]> {
  const productIds = products.map((product) => product.id).filter(Boolean)
  const catalogNumbers = products
    .flatMap((product) => [product.cat_no, product.slug])
    .filter((value): value is string => Boolean(value))

  if (productIds.length === 0 && catalogNumbers.length === 0) return []

  try {
    const admin = createAdminClient()
    let rows: Array<{
      id: string
      title: string
      catalog_number?: string | null
      content?: Record<string, string> | null
      updated_at?: string | null
    }> = []

    if (productIds.length > 0) {
      const { data, error } = await admin
        .from('auto_datasheets')
        .select('id, title, catalog_number, content, updated_at')
        .eq('status', 'published')
        .in('product_id', productIds)
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.warn('Official datasheet lookup by product failed:', error.message)
      } else if (data) {
        rows = data as typeof rows
      }
    }

    if (rows.length === 0 && catalogNumbers.length > 0) {
      const { data, error } = await admin
        .from('auto_datasheets')
        .select('id, title, catalog_number, content, updated_at')
        .eq('status', 'published')
        .in('catalog_number', catalogNumbers)
        .order('updated_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.warn('Official datasheet lookup by catalog number failed:', error.message)
      } else if (data) {
        rows = data as typeof rows
      }
    }

    const normalizedQuery = query.toLowerCase()
    return rows
      .filter((row) => row.content && typeof row.content === 'object')
      .slice(0, limit)
      .map((row) => {
        const content = row.content || {}
        const orderedKeys = /洗板|显色|标准品|操作|步骤|孵育|结果|样本|保存|稀释|复孔|空白/i.test(normalizedQuery)
          ? ['header', 'sample_collection', 'sample_notes', 'sample_storage', 'operation_notes', 'reagent_preparation', 'washing_method', 'procedure', 'procedure_summary', 'results']
          : ['header', 'principle', 'operation_notes', 'results']
        const pickedContent = Object.fromEntries(
          orderedKeys
            .map((key) => [key, typeof content[key] === 'string' ? content[key] : ''])
            .filter(([, value]) => Boolean(value))
        )
        return {
          id: row.id,
          title: row.title,
          catalog_number: row.catalog_number,
          updated_at: row.updated_at,
          content: pickedContent,
        }
      })
      .filter((row) => Object.keys(row.content).length > 0)
  } catch (err: unknown) {
    console.warn('Official datasheet retrieval error:', getErrorMessage(err, '说明书检索失败'))
    return []
  }
}

function isModelConfigError(message: string) {
  return [
    'DEEPSEEK_API_KEY_MISSING',
    'DEEPSEEK_AUTH_ERROR',
    'DEEPSEEK_INSUFFICIENT_BALANCE',
    'KIMI_API_KEY_MISSING',
    'KIMI_AUTH_ERROR',
    'KIMI_RATE_LIMIT',
    'KIMI_INSUFFICIENT_BALANCE',
  ].some((code) => message.includes(code))
}

function modelStatusText(message: string) {
  if (message.includes('DEEPSEEK_INSUFFICIENT_BALANCE') || message.includes('KIMI_INSUFFICIENT_BALANCE')) {
    return '云端 AI 服务额度不足，暂时无法调用大模型。'
  }

  if (message.includes('DEEPSEEK_AUTH_ERROR') || message.includes('KIMI_AUTH_ERROR')) {
    return '云端 AI 服务鉴权失败，可能是 API Key 无效或已过期。'
  }

  if (message.includes('KIMI_RATE_LIMIT')) {
    return '云端 AI 服务请求过于频繁，系统稍后可自动恢复。'
  }

  return '云端 AI 服务暂未完成配置。'
}

function buildFallbackAnswer(
  query: string,
  mode: string,
  products: ProductReference[],
  knowledge: KnowledgeReference[],
  errorMessage: string
) {
  const status = modelStatusText(errorMessage)
  const matchedProducts = products.slice(0, 3)
  const refs = knowledge.slice(0, 3)

  const productSection = matchedProducts.length > 0
    ? `\n\n我先根据当前产品库匹配到以下 AIMENG UNING 产品，供您参考：\n${matchedProducts
        .map((p, index) => `${index + 1}. ${p.name || p.target || '相关产品'}：货号 ${p.cat_no || '待确认'}，种属 ${p.species || '待确认'}，检测范围 ${p.detection_range || '待确认'}，灵敏度 ${p.sensitivity || '待确认'}。`)
        .join('\n')}`
    : ''

  const knowledgeSection = refs.length > 0
    ? `\n\n可参考的知识库内容：\n${refs
        .map((k, index) => `${index + 1}. ${k.title}`)
        .join('\n')}`
    : ''

  const lowerQuery = query.toLowerCase()
  const protocolHint = mode === 'protocol' || query.includes('方案') || query.includes('模型') || lowerQuery.includes('model')
    ? `\n\n关于您提到的实验设计/模型问题，可以先按这个思路梳理：\n1. 动物模型：如炎症模型、肿瘤模型、代谢疾病模型、自身免疫模型等，常用于检测血清、血浆或组织匀浆中的目标因子。\n2. 细胞模型：如 LPS 刺激炎症模型、药物处理模型、基因敲降/过表达模型等，常检测细胞上清或裂解液。\n3. 临床/样本分组模型：如健康对照组、疾病组、治疗前后组、不同分期组，重点是样本来源和分组标准一致。\n4. 体外处理模型：如蛋白刺激、细胞因子诱导、药物浓度梯度、时间梯度处理，适合做机制验证。\n5. 质控设计：每组设置足够生物学重复，ELISA 检测时标准品和样本优先做复孔；先做预实验，让样本 OD 值落在标准曲线中段。`
    : ''

  return `抱歉，${status}我现在先用网站本地产品库和知识库给您一个基础答复。\n\n您的问题：${query || '未提供具体问题'}${productSection}${protocolHint}${knowledgeSection}\n\n如果您需要完整 AI 追问式方案，请稍后再试，或联系爱萌优宁工作人员协助确认。`
}

function buildSerumFallbackHint(query: string) {
  if (!/采血|取血|羊血|sheep|麻醉|镇静|动物实验|血清采集/i.test(query)) return ''

  return `\n\n关于动物采血这类问题，我可以先给出通用原则：\n1. 常规羊血清采集通常以物理保定为基础，是否需要局部麻醉或镇静，取决于采血部位、采血量、动物状态、操作人员熟练度和机构 SOP。\n2. 颈静脉采血是常见方式，少量采血一般不需要全身麻醉；如果动物应激明显、需要反复穿刺、采血部位特殊或操作风险较高，应由兽医评估是否需要局部麻醉或镇静。\n3. 操作前必须取得动物伦理审批，遵守机构 IACUC/动物伦理委员会要求和当地法规；采血过程要尽量减少疼痛、应激和感染风险。\n4. 如果目的是制备血清，重点还包括无菌采集、凝血时间、离心条件、溶血控制、分装冻存和批次记录。\n\n我不能替代兽医或动物伦理委员会给出最终用药方案；具体麻醉/镇静药物和剂量应由执业兽医或机构 SOP 决定。`
}

function buildExactProductAnswer(query: string, product: ProductReference) {
  const catalog = product.cat_no || product.catalog_number || '待确认'
  const name = product.name || `${product.species || ''} ${product.target || ''} ELISA Kit`.trim()
  const target = product.target || '待确认'
  const species = product.species || '待确认'
  const detailLink = product.slug ? `/products/${product.slug}` : '/products/elisa'
  const range = product.detection_range || '以产品详情页/说明书为准'
  const sensitivity = product.sensitivity || '以产品详情页/说明书为准'

  return [
    `根据 AIMENG UNING 产品库，已为您精确匹配到这款产品：`,
    '',
    `1. 产品：${name}`,
    `2. 货号：${catalog}`,
    `3. 种属：${species}`,
    `4. 检测指标：${target}`,
    `5. 检测范围：${range}`,
    `6. 灵敏度：${sensitivity}`,
    `7. 规格与价格：48T 1800 元；96T 2400 元。`,
    `8. 产品详情：${detailLink}`,
    '',
    '选择时建议再确认 3 个信息：样本类型（血清/血浆/细胞上清/组织匀浆等）、样本数量、是否做复孔。若您的样本类型或预期浓度不确定，可以把实验目的发给客服进一步确认。',
    '',
    `您的原始查询：${query}`,
  ].join('\n')
}

function getLearningSignal(messages: ChatMessage[]): LearningSignal | null {
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user')
  if (lastUserIndex <= 0) return null

  const currentUserMessage = messages[lastUserIndex]?.content || ''
  const previousMessages = messages.slice(0, lastUserIndex)
  const previousAssistant = [...previousMessages].reverse().find((message) => message.role === 'assistant')
  if (!previousAssistant?.content) return null

  const normalized = currentUserMessage.replace(/\s+/g, '')
  const hasStrongCorrection = /不对|不准确|错误|错了|不是这样|不应该|不能这样|不符合|不一致|漏了|没提到|没有提到|纠正|更正|异议|不满意|回答.*问题/.test(normalized)
  const hasSupplement = /补充|我觉得|我认为|其实|但是|不过|另外|还需要|建议|应该|需要注意|核心要求|关键/.test(normalized)
  const hasUsefulLength = currentUserMessage.trim().length >= 18

  if (!hasStrongCorrection && !(hasSupplement && hasUsefulLength)) return null

  const previousUser = [...previousMessages]
    .reverse()
    .find((message) => message.role === 'user')

  return {
    previousUserQuestion: previousUser?.content || currentUserMessage,
    previousAssistantAnswer: previousAssistant.content,
  }
}

function inferLearningCategory(text: string) {
  if (/胎牛血清|血清|特殊血清|动物血|补体|热灭活|细胞培养/.test(text)) return '血清应用'
  if (/样本|血浆|血清|组织|上清|保存|采集|处理/.test(text)) return '样本处理'
  if (/标准曲线|洗板|显色|孵育|复孔|空白|OD|ELISA|试剂盒/i.test(text)) return '操作技巧'
  if (/方案|设计|模型|分组|对照/.test(text)) return '实验设计'
  return '产品指南'
}

function buildLearningTags(text: string) {
  const tags = ['客户异议', '待审核']
  if (/胎牛血清|FBS/i.test(text)) tags.push('胎牛血清')
  if (/血清|特殊血清|动物血/.test(text)) tags.push('血清')
  if (/ELISA|试剂盒|标准曲线/i.test(text)) tags.push('ELISA')
  if (/细胞培养|免疫细胞|巨噬|NK|T细胞/.test(text)) tags.push('细胞培养')
  if (/热灭活|补体/.test(text)) tags.push('热灭活')
  return Array.from(new Set(tags)).slice(0, 6)
}

async function createLearningCandidateFromObjection(
  supabase: SupabaseClient,
  params: {
    conversationId: string
    currentUserMessage: string
    currentAssistantAnswer: string
    previousUserQuestion: string
    previousAssistantAnswer: string
  }
) {
  const combinedText = [
    params.previousUserQuestion,
    params.previousAssistantAnswer,
    params.currentUserMessage,
    params.currentAssistantAnswer,
  ].join('\n')
  const category = inferLearningCategory(combinedText)
  const tags = buildLearningTags(combinedText)
  const suggestedTitle = params.currentUserMessage
    .replace(/\s+/g, ' ')
    .replace(/[。！？!?].*$/, '')
    .slice(0, 80) || '客户异议沉淀知识候选'

  const { data: existing } = await supabase
    .from('knowledge_candidates')
    .select('id')
    .eq('source_conversation_id', params.conversationId)
    .eq('source_type', 'ai_objection')
    .maybeSingle()

  if (existing?.id) return existing.id as string

  const content = [
    '## 原始问题',
    params.previousUserQuestion || '未记录',
    '',
    '## AI 原回答（供审核参考）',
    params.previousAssistantAnswer.slice(0, 1800),
    '',
    '## 客户提出的异议或补充',
    params.currentUserMessage,
    '',
    '## AI 修正后的回复（供审核参考）',
    params.currentAssistantAnswer.slice(0, 2200),
    '',
    '## 审核建议',
    '请管理员确认客户补充是否准确；通过后可整理成正式知识库条目，后续类似问题优先引用。',
  ].join('\n')

  const answer = [
    '客户在对话中提出了可复用的专业补充或纠正：',
    params.currentUserMessage,
    '',
    'AI 后续回复中的可参考修正：',
    params.currentAssistantAnswer.slice(0, 1000),
  ].join('\n')

  const { data, error } = await supabase
    .from('knowledge_candidates')
    .insert({
      source_conversation_id: params.conversationId,
      source_type: 'ai_objection',
      question: params.previousUserQuestion || params.currentUserMessage,
      answer,
      suggested_title: suggestedTitle,
      content,
      category,
      tags,
      ai_quality_score: 0.82,
      ai_extract_reason: '客户对 AI 客服回答提出异议或专业补充，系统自动沉淀为待审核知识候选，审核通过后用于后续类似问题。',
      status: 'pending',
      review_note: '来自客户异议自动提取',
    })
    .select('id')
    .single()

  if (error) throw error
  return data.id as string
}

function streamTextResponse(text: string, sources: SourceReference[] = [], conversationId?: string, sourceType?: string) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ text, done: false, sources, conversationId, sourceType })}
\n\n`)
      )
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullText: text, conversationId, sourceType })}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

export async function POST(request: NextRequest) {
  let query = ''
  try {
    const requestStartedAt = Date.now()
    const body = await request.json()
    const { messages: rawMessages, mode = 'pre-sales', sessionId } = body as {
      messages: ChatMessage[]
      mode: string
      sessionId?: string
    }

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages required' }), { status: 400 })
    }

    const messages = rawMessages
      .filter((message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
      .slice(-12)
      .map((message) => ({
        role: message.role,
        content: message.content.trim().slice(0, 4000),
      }))

    if (messages.length === 0 || messages.reduce((total, message) => total + message.content.length, 0) > 12000) {
      return new Response(JSON.stringify({ error: '消息内容过长，请分段发送' }), { status: 400 })
    }

    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')
    query = lastUserMessage?.content || ''
    const domain = guardAiDomain(query, messages)
    if (!domain.allowed) {
      return streamTextResponse(domain.response || '当前问题不在客服服务范围内。')
    }

    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id || null
    } catch (error) {
      console.warn('[ai/chat] unable to read user session', error)
    }

    const usage = await reserveAiRequest(request, userId, estimateAiTokens(messages))
    if (!usage.allowed) {
      return new Response(JSON.stringify({ error: usage.reason || 'AI 使用频率已达到安全上限，请稍后再试' }), {
        status: 429,
        headers: { 'Retry-After': String(usage.retryAfterSeconds) },
      })
    }

    const aiSettings = await getAiModelSettings({ refresh: true })
    const requestedProvider = getProviderForAiTask(aiSettings, 'chat')
    let usedProvider: AiProvider = requestedProvider
    let usedModel = ''

    const learningSignal = getLearningSignal(messages)
    const conversationId = randomUUID()

    // These three lookups do not depend on one another. Running them together
    // shortens the time before the first streamed answer reaches the customer.
    const [products, serumProducts, knowledge] = await Promise.all([
      retrieveProducts(query, CHAT_PRODUCT_LIMIT),
      retrieveSerumProducts(query, CHAT_SERUM_LIMIT),
      retrieveKnowledge(query, CHAT_KNOWLEDGE_LIMIT),
    ])

    const productText = products
      .map((p, i) =>
        `[产品${i + 1}] 货号：${p.cat_no || p.catalog_number || 'N/A'} | 名称：${p.name} | 靶标：${p.target || 'N/A'} | 种属：${p.species || 'N/A'} | 检测范围：${p.detection_range || 'N/A'} | 灵敏度：${p.sensitivity || 'N/A'} | 价格：${p.price || 'N/A'} | 库存：${p.stock_status === 'in_stock' ? '现货' : '缺货'} | 链接：/products/${p.slug}`
      )
      .join('\n')

    const serumProductText = serumProducts
      .map((p, i) => {
        const qualityItems = (p.quality_items || []).slice(0, 4).map((item) => `${item.label}:${item.value}`).join('；')
        return `[血清产品${i + 1}] 名称：${p.name} | 货号：${p.catalog_number || '待确认'} | 分类：${p.category === 'fbs' ? '胎牛血清' : '动物血制品'} | 类型：${p.serum_type || '待确认'} | 规格：${p.package_size || '待确认'} | 来源：${p.origin || '待确认'} | 应用：${(p.applications || []).slice(0, 4).join('、') || '待确认'} | 质控：${qualityItems || '以 COA 为准'} | 链接：/products/${p.category === 'fbs' ? 'fbs' : 'animal-serum'}/${p.slug}`
      })
      .join('\n')

    const officialDatasheets = await retrieveOfficialDatasheets(products, query, CHAT_DATASHEET_LIMIT)
    const officialDatasheetRefs = officialDatasheets.map((doc) => ({
      id: `datasheet-${doc.id}`,
      title: `官方说明书：${doc.title}${doc.catalog_number ? `（${doc.catalog_number}）` : ''}`,
      similarity: 1,
    }))
    const officialDatasheetText = buildOfficialDatasheetContext(officialDatasheets)

    const sourceRefs = [...officialDatasheetRefs, ...knowledge.map((k) => ({ title: k.title, id: k.id, similarity: k.similarity }))]
    const contextText = knowledge
      .map((k, i) => `[${i + 1}] ${k.title}\n${k.content.slice(0, MAX_KNOWLEDGE_SNIPPET_CHARS)}`)
      .join('\n\n')
    const sourceType = officialDatasheets.length > 0 || products.length > 0 || serumProducts.length > 0 ? 'product' : knowledge.length > 0 ? 'knowledge' : 'rag'
    const admin = createAdminClient()
    const initialConversationPayload = {
      id: conversationId,
      user_id: userId,
      question: query,
      answer: '',
      source_type: sourceType,
      products_referenced: [
        ...products.map((p) => p.id),
        ...serumProducts.map((p) => p.slug),
      ],
    }
    let { error: initialConversationError } = await admin.from('ai_conversations').insert(initialConversationPayload)

    if (
      initialConversationError &&
      (initialConversationError.message.includes('source_type') ||
        initialConversationError.message.includes('products_referenced'))
    ) {
      const fallbackInsert = await admin.from('ai_conversations').insert({
        id: conversationId,
        user_id: null,
        question: query,
        answer: '',
      })
      initialConversationError = fallbackInsert.error
    }

    const savedConversationId = initialConversationError ? null : conversationId
    if (initialConversationError) {
      console.error('Failed to initialize ai_conversation:', initialConversationError.message)
    }

    if (mode === 'pre-sales' && products.length === 1 && /elisa|试剂盒|选择|选型|推荐|货号|检测|指标|靶标|IL|白介素|LV\d+/i.test(query)) {
      const exactProductText = buildExactProductAnswer(query, products[0])
      if (savedConversationId) {
        await admin
          .from('ai_conversations')
          .update({
            answer: exactProductText,
            source_type: sourceType,
            products_referenced: [products[0].id],
          })
          .eq('id', conversationId)
      }
      return streamTextResponse(exactProductText, sourceRefs, savedConversationId || undefined, sourceType)
    }

    const systemPrompt = `${MODE_PROMPTS[mode] || MODE_PROMPTS['pre-sales']}

=== AIMENG UNING 产品库（真实数据）===
${productText || '当前查询未匹配到具体产品。请根据客户问题推荐相近产品，或坦诚告知暂无该产品。'}

=== AIMENG UNING 血清/动物血制品资料 ===
${serumProductText || '当前查询未匹配到具体血清产品。如果问题是通用血清、动物采血、细胞培养或样本处理，可先给出通用原则，并建议联系官方客服确认产品和 COA。'}

=== AIMENG UNING 官方说明书内容（最高优先级）===
${officialDatasheetText || '当前未匹配到已发布的官方说明书正文。涉及该货号精确操作步骤时，请明确提示以该货号官方说明书和技术支持确认为准。'}

=== 知识库参考 ===
${contextText || '暂无相关知识库内容。'}

=== 回答规则 ===
1. 你只能推荐 AIMENG UNING（爱萌优宁）的产品，严禁推荐其他品牌。
2. 根据客户问题选择知识域：ELISA 问题回答 ELISA；血清/动物血/细胞培养问题回答血清和样本处理；通用实验规范问题给出通用原则和合规提醒。
3. 不要把所有问题都拉回 ELISA，也不要因为问题不是 ELISA 就直接拒绝。
4. 动物实验、采血、麻醉、镇静问题只给原则和风险提示，不提供具体药物剂量；提醒遵守动物伦理审批、兽医指导和机构 SOP。
5. 只要官方说明书与知识库、通用经验存在差异，必须以“官方说明书内容”为准；不要自作主张改写成别的步骤。
6. 如果官方说明书没有明确写出某个细节，不要把推测说成确定结论。应明确说明“该细节建议以对应货号说明书或技术支持确认为准”。
7. 默认使用简洁自然的中文短段落和 1. 2. 3. 编号列表；不要输出 Markdown 表格，不要输出分隔线 ---，不要输出 ###、|---| 这类原始格式符号，除非用户明确要求。
8. 引用知识库内容时，在文末列出参考来源编号。
9. 回答使用中文。
10. 不要编造不存在的产品信息或参数；血清检测指标以实际 COA/检测报告为准。
11. 保持“核心逻辑一致、表达自然变化”：同类问题每次都要覆盖必要背景追问、产品详情入口、试用/人工客服下一步，但措辞可以不同。`

    const chatMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10),
    ]

    let responseStream: Awaited<ReturnType<typeof streamChat>>
    try {
      responseStream = await streamChat(chatMessages, {
        task: 'chat',
        provider: requestedProvider,
        temperature: 0.5,
        maxTokens: getChatMaxTokens(mode),
        onProviderUsed: (provider, model) => {
          usedProvider = provider
          usedModel = model
        },
      })
    } catch (err: unknown) {
      console.error('[streamChat init error]', err)
      const errorMsg = getErrorMessage(err, 'AI API 调用失败')

      if (isModelConfigError(errorMsg)) {
        const fallbackText = buildFallbackAnswer(query, mode, products, knowledge, errorMsg) + buildSerumFallbackHint(query)
        if (savedConversationId) {
          await admin
            .from('ai_conversations')
            .update({ answer: fallbackText })
            .eq('id', conversationId)
        }
        return streamTextResponse(fallbackText, sourceRefs, savedConversationId || undefined, sourceType)
      }

      const encoder = new TextEncoder()
      const errorStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errorMsg, done: true })}
\n\n`)
          )
          controller.close()
        },
      })
      return new Response(errorStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = ''
        try {
          for await (const chunk of responseStream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (!text) continue
            fullText += text
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text, done: false, sources: sourceRefs, conversationId: savedConversationId, sourceType, ai: { provider: usedProvider, model: usedModel || undefined } })}
\n\n`
              )
            )
          }

          if (!fullText.trim()) {
            const fallbackText = buildFallbackAnswer(query, mode, products, knowledge, 'AI_EMPTY_STREAM_RESPONSE') + buildSerumFallbackHint(query)
            fullText = fallbackText
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ text: fallbackText, done: false, sources: sourceRefs, conversationId: savedConversationId, sourceType, ai: { provider: usedProvider, model: usedModel || undefined } })}\n\n`
              )
            )
          }

          const supabase = await createClient()

          if (sessionId) {
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
                  sources: knowledge.map((k) => k.id),
                },
              ])
            }
          }

          if (savedConversationId) {
            const { error: conversationError } = await admin
              .from('ai_conversations')
              .update({
                answer: fullText,
                source_type: sourceType,
                products_referenced: [
                  ...products.map((p) => p.id),
                  ...serumProducts.map((p) => p.slug),
                ],
              })
              .eq('id', conversationId)

            if (conversationError) {
              if (
                conversationError.message.includes('source_type') ||
                conversationError.message.includes('products_referenced')
              ) {
                const fallbackUpdate = await admin
                  .from('ai_conversations')
                  .update({ answer: fullText })
                  .eq('id', conversationId)
                if (fallbackUpdate.error) {
                  console.error('Failed to save ai_conversation:', fallbackUpdate.error.message)
                }
              } else {
                console.error('Failed to save ai_conversation:', conversationError.message)
              }
            }

            if (learningSignal) {
              try {
                const candidateId = await createLearningCandidateFromObjection(admin, {
                  conversationId,
                  currentUserMessage: query,
                  currentAssistantAnswer: fullText,
                  previousUserQuestion: learningSignal.previousUserQuestion,
                  previousAssistantAnswer: learningSignal.previousAssistantAnswer,
                })
                await admin
                  .from('ai_conversations')
                  .update({ extracted_at: new Date().toISOString() })
                  .eq('id', conversationId)
                console.log('[ai/chat] Created objection learning candidate:', candidateId)
              } catch (candidateError: unknown) {
                console.error('[ai/chat] objection candidate error:', getErrorMessage(candidateError, '知识候选生成失败'))
              }
            }
          }

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, fullText, conversationId: savedConversationId, sourceType, ai: { provider: usedProvider, model: usedModel || undefined } })}\n\n`))
          controller.close()
        } catch (e: unknown) {
          console.error('Stream error:', e)
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: `AI 流式输出错误: ${getErrorMessage(e, '未知错误')}`, done: true })}\n\n`
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
        'Server-Timing': `aimeng-chat-prestream;dur=${Date.now() - requestStartedAt}`,
      },
    })
  } catch (err: unknown) {
    console.error('Chat API error:', err)
    return new Response(
      JSON.stringify({
        error: getErrorMessage(err, 'AI 客服调用失败'),
        detail: 'AI 模型调用失败，请检查 API Key、环境变量和后台 AI 模型设置。',
      }),
      { status: 500 }
    )
  }
}
