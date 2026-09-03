export type DomainGuardResult = {
  allowed: boolean
  kind: 'domain' | 'greeting' | 'off_topic'
  response?: string
}

const LOCAL_RESPONSE = '我是爱萌优宁实验与产品客服，目前只回答 ELISA、血清、细胞培养、WB/IHC、生化检测、实验方案及本公司产品相关问题。请把具体的实验、样本、检测指标或产品货号发给我。'

const DOMAIN_PATTERNS = [
  /elisa|酶联免疫|酶标|4pl|五参数|标准曲线|od值|吸光度|标曲/i,
  /细胞培养|细胞系|原代细胞|培养基|胰酶|传代|冻存|复苏|支原体|细胞上清/i,
  /western\s*blot|western blot|wb实验|免疫印迹|免疫组化|ihc|生化检测/i,
  /试剂盒|试剂|血清|血浆|胎牛|fbs|动物血|样本|组织匀浆|上清|抗体|蛋白|靶标|指标/i,
  /细胞因子|白介素|肿瘤坏死因子|生长因子|趋化因子|炎症因子|受体|激酶|通路|生物标志物|疾病模型/i,
  /实验|protocol|操作步骤|孵育|洗板|显色|稀释|复孔|空白|对照|分组|实验方案|实验设计/i,
  /爱萌优宁|aimeng|uning|货号|产品|说明书|coa|数据分析|酶标板|报价|库存|订单|售前|售后|发货/i,
  /\bLV\d{5,6}\b/i,
  /\b(?:IL|TNF|TGF|IFN|VEGF|EGF|FGF|PDGF|MMP|CD|CXCL|CCL|IGF|BMP|STAT|AKT|ERK|NF)[- ]?[A-Zα-ωΑ-Ω]?\d+[A-Z]?\b/i,
  /(?:alpha|beta|gamma|α|β|γ)[- ]?\d*/i,
]

const GREETING_PATTERN = /^(你好|您好|嗨|hello|hi|hey|在吗|早上好|下午好|晚上好|谢谢|感谢|再见|拜拜)[!！。,.，\s]*$/i

const OBVIOUS_OFF_TOPIC_PATTERNS = [
  /西藏|自驾|旅游|旅行|景点|酒店|机票|路线规划|攻略/i,
  /股票|基金|彩票|博彩|贷款|借钱|理财|加密货币|比特币/i,
  /写代码|编程|javascript|python|sql|算法题|写小说|作文|翻译|论文润色/i,
  /天气|新闻|明星|电影|电视剧|游戏|音乐|菜谱|健身|减肥|法律咨询|政治/i,
]

function normalized(text: string) {
  return text.replace(/\s+/g, '').trim()
}

function hasDomainSignal(text: string) {
  return DOMAIN_PATTERNS.some((pattern) => pattern.test(text))
}

function domainSignalCount(text: string) {
  return DOMAIN_PATTERNS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0)
}

function hasDomainContext(messages: Array<{ role?: string; content?: unknown }>) {
  return messages
    .slice(-8, -1)
    .some((message) => typeof message.content === 'string' && hasDomainSignal(message.content))
}

export function guardAiDomain(
  query: string,
  messages: Array<{ role?: string; content?: unknown }> = [],
): DomainGuardResult {
  const text = normalized(query)
  if (!text) return { allowed: false, kind: 'off_topic', response: LOCAL_RESPONSE }

  if (GREETING_PATTERN.test(text)) {
    return {
      allowed: false,
      kind: 'greeting',
      response: '您好，我是爱萌优宁实验与产品客服。您可以咨询 ELISA、血清、细胞培养、WB/IHC、生化检测、实验方案或本公司产品。',
    }
  }

  const domainSignals = domainSignalCount(text)
  const obviousOffTopic = OBVIOUS_OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(text))
  if (domainSignals > 0 && (!obviousOffTopic || domainSignals >= 2)) return { allowed: true, kind: 'domain' }

  // Short follow-ups such as "为什么" and "继续" inherit the established lab context.
  if (text.length <= 24 && hasDomainContext(messages)) return { allowed: true, kind: 'domain' }

  if (obviousOffTopic) {
    return { allowed: false, kind: 'off_topic', response: LOCAL_RESPONSE }
  }

  return { allowed: false, kind: 'off_topic', response: LOCAL_RESPONSE }
}
