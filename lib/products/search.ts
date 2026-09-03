import { normalizeElisaCatalogNumber } from './catalog'
import { SPECIES_QUERY_VALUES, getSpeciesQueryValues, normalizeSpeciesName } from './species'

const GREEK_WORDS: Array<[string, string[]]> = [
  ['α', ['alpha', 'alfa', 'a']],
  ['β', ['beta', 'b']],
  ['γ', ['gamma', 'g']],
  ['δ', ['delta', 'd']],
  ['ε', ['epsilon', 'e']],
  ['ζ', ['zeta', 'z']],
  ['η', ['eta']],
  ['θ', ['theta']],
  ['κ', ['kappa']],
  ['λ', ['lambda']],
  ['μ', ['mu', 'micro']],
  ['π', ['pi']],
  ['ρ', ['rho']],
  ['σ', ['sigma']],
  ['τ', ['tau']],
  ['φ', ['phi']],
  ['χ', ['chi']],
  ['ω', ['omega']],
]

const CHINESE_NUMBERS: Record<string, number> = {
  零: 0,
  〇: 0,
  一: 1,
  壹: 1,
  二: 2,
  两: 2,
  贰: 2,
  三: 3,
  叁: 3,
  四: 4,
  肆: 4,
  五: 5,
  伍: 5,
  六: 6,
  陆: 6,
  七: 7,
  柒: 7,
  八: 8,
  捌: 8,
  九: 9,
  玖: 9,
}

const ROMAN_NUMBERS: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
  ix: 9,
  x: 10,
}

const CHINESE_BIOMARKER_ALIASES: Array<{
  pattern: RegExp
  prefix: string
  english?: string
}> = [
  { pattern: /(?:白介素|白细胞介素)[\s-]*([零〇一二两三四五六七八九十拾壹贰叁肆伍陆柒捌玖\d]+)/g, prefix: 'IL', english: 'Interleukin' },
  { pattern: /(?:干扰素)[\s-]*([αβγδ]|alpha|beta|gamma|delta|[a-d])?/gi, prefix: 'IFN', english: 'Interferon' },
  { pattern: /(?:肿瘤坏死因子)[\s-]*([αβγδ]|alpha|beta|gamma|delta|[a-d])?/gi, prefix: 'TNF', english: 'Tumor Necrosis Factor' },
  { pattern: /(?:转化生长因子)[\s-]*([αβγδ]|alpha|beta|gamma|delta|[a-d])?[\s-]*(\d+)?/gi, prefix: 'TGF', english: 'Transforming Growth Factor' },
  { pattern: /(?:血管内皮生长因子)[\s-]*([a-zαβγδ]|\d+)?/gi, prefix: 'VEGF', english: 'Vascular Endothelial Growth Factor' },
  { pattern: /(?:表皮生长因子)[\s-]*(\d+)?/gi, prefix: 'EGF', english: 'Epidermal Growth Factor' },
  { pattern: /(?:成纤维细胞生长因子)[\s-]*([零〇一二两三四五六七八九十拾壹贰叁肆伍陆柒捌玖\d]+)?/g, prefix: 'FGF', english: 'Fibroblast Growth Factor' },
  { pattern: /(?:胰岛素样生长因子)[\s-]*([零〇一二两三四五六七八九十拾壹贰叁肆伍陆柒捌玖\d]+)?/g, prefix: 'IGF', english: 'Insulin-like Growth Factor' },
  { pattern: /(?:基质金属蛋白酶)[\s-]*([零〇一二两三四五六七八九十拾壹贰叁肆伍陆柒捌玖\d]+)?/g, prefix: 'MMP', english: 'Matrix Metalloproteinase' },
]

const DIRECT_CHINESE_TARGET_ALIASES: Array<[RegExp, string[]]> = [
  [/超氧化物歧化酶|过氧化物歧化酶/g, ['SOD', 'Superoxide Dismutase']],
  [/丙二醛/g, ['MDA', 'Malondialdehyde']],
  [/谷胱甘肽过氧化物酶/g, ['GSH-Px', 'GPx', 'Glutathione Peroxidase']],
  [/谷胱甘肽/g, ['GSH', 'Glutathione']],
  [/过氧化氢酶/g, ['CAT', 'Catalase']],
  [/髓过氧化物酶/g, ['MPO', 'Myeloperoxidase']],
  [/一氧化氮合酶/g, ['NOS', 'Nitric Oxide Synthase']],
  [/一氧化氮/g, ['NO', 'Nitric Oxide']],
  [/皮质醇/g, ['Cortisol']],
  [/胰岛素/g, ['INS', 'Insulin']],
]

const PRODUCT_SEARCH_STOPWORDS = [
  'elisa',
  'enzyme linked immunosorbent assay',
  'kit',
  'kits',
  '试剂盒',
  '检测试剂盒',
  '检测',
  '指标',
  '靶标',
  '目标蛋白',
  '产品',
  '货号',
  '选择',
  '选型',
  '推荐',
  '搜索',
  '查询',
  '怎么',
  '如何',
  '哪款',
  '哪个',
  '有没有',
  '请问',
  '一下',
  '爱萌',
  '爱萌优宁',
  'aimeng',
  'uning',
]

const SPECIES_SEARCH_ALIASES = Object.entries(SPECIES_QUERY_VALUES)
  .flatMap(([species, aliases]) => [species, ...aliases].map((alias) => ({ species, alias })))
  .filter((item) => item.alias.trim())
  .sort((a, b) => b.alias.length - a.alias.length)

function unique(values: string[]) {
  return [...new Set(values.map((value) => normalizeSearchTerm(value)).filter(Boolean))]
}

function parseChineseNumber(value: string) {
  const text = value.trim()
  if (!text) return null
  if (/^\d+$/.test(text)) return Number(text)
  if (/^[零〇一二两三四五六七八九壹贰叁肆伍陆柒捌玖]$/.test(text)) return CHINESE_NUMBERS[text]

  const normalized = text.replace(/拾/g, '十')
  if (!/^[零〇一二两三四五六七八九十壹贰叁肆伍陆柒捌玖]+$/.test(normalized)) return null
  if (!normalized.includes('十')) {
    return Number(
      normalized
        .split('')
        .map((char) => CHINESE_NUMBERS[char])
        .join('')
    )
  }

  const [left, right] = normalized.split('十')
  const tens = left ? CHINESE_NUMBERS[left] : 1
  const ones = right ? CHINESE_NUMBERS[right] : 0
  if (tens == null || ones == null) return null
  return tens * 10 + ones
}

function romanToNumber(value: string) {
  return ROMAN_NUMBERS[value.toLowerCase()] || null
}

function replaceChineseNumbers(value: string) {
  return value.replace(/[零〇一二两三四五六七八九十拾壹贰叁肆伍陆柒捌玖]+/g, (match) => {
    const parsed = parseChineseNumber(match)
    return parsed == null ? match : String(parsed)
  })
}

function greekSuffixVariants(value?: string) {
  const suffix = normalizeSearchTerm(value || '')
  if (!suffix) return ['']

  const compact = compactSearchTerm(suffix).toLowerCase()
  for (const [symbol, words] of GREEK_WORDS) {
    if (suffix === symbol || words.includes(compact)) {
      return [symbol, words[0], words[0][0]].filter(Boolean)
    }
  }
  return [suffix]
}

function addBiomarkerVariants(
  variants: Set<string>,
  prefix: string,
  suffixes: string[],
  english?: string
) {
  const cleanSuffixes = suffixes.length > 0 ? suffixes.filter((suffix) => suffix != null) : ['']
  for (const suffix of cleanSuffixes) {
    const normalizedSuffix = normalizeSearchTerm(String(suffix || ''))
    const compactSuffix = compactSearchTerm(normalizedSuffix)
    const suffixVariants = normalizedSuffix ? greekSuffixVariants(normalizedSuffix) : ['']

    for (const suffixVariant of suffixVariants) {
      const compactVariant = compactSearchTerm(suffixVariant)
      const tokens = compactVariant ? [`${prefix}-${compactVariant}`, `${prefix} ${compactVariant}`, `${prefix}${compactVariant}`] : [prefix]
      for (const token of tokens) variants.add(token)
      if (english) {
        variants.add(compactVariant ? `${english}-${compactVariant}` : english)
        variants.add(compactVariant ? `${english} ${compactVariant}` : english)
      }
    }

    const numeric = parseChineseNumber(normalizedSuffix) ?? (/^\d+$/.test(compactSuffix) ? Number(compactSuffix) : null)
    if (numeric != null) {
      variants.add(`${prefix}-${numeric}`)
      variants.add(`${prefix} ${numeric}`)
      variants.add(`${prefix}${numeric}`)
      if (english) {
        variants.add(`${english}-${numeric}`)
        variants.add(`${english} ${numeric}`)
      }
    }
  }
}

function addChineseTargetAliases(base: string, variants: Set<string>) {
  for (const [pattern, aliases] of DIRECT_CHINESE_TARGET_ALIASES) {
    pattern.lastIndex = 0
    if (pattern.test(base)) {
      for (const alias of aliases) variants.add(alias)
    }
  }

  for (const aliasRule of CHINESE_BIOMARKER_ALIASES) {
    aliasRule.pattern.lastIndex = 0
    for (const match of base.matchAll(aliasRule.pattern)) {
      addBiomarkerVariants(
        variants,
        aliasRule.prefix,
        [match[1] || '', match[2] || ''].filter(Boolean),
        aliasRule.english
      )
      if (!match[1] && !match[2]) {
        addBiomarkerVariants(variants, aliasRule.prefix, [''], aliasRule.english)
      }
    }
  }
}

export function normalizeSearchTerm(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[，,。.!！?？()（）【】[\]{};；:：%]/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/[“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripStopwords(value: string) {
  let text = ` ${normalizeSearchTerm(value)} `

  for (const word of PRODUCT_SEARCH_STOPWORDS) {
    const escaped = escapeRegExp(word)
    const isAscii = /^[a-z0-9\s-]+$/i.test(word)
    const pattern = isAscii
      ? new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'gi')
      : new RegExp(escaped, 'g')
    text = text.replace(pattern, ' ')
  }

  return normalizeSearchTerm(text)
}

export function parseProductSearchIntent(value: string) {
  const original = normalizeSearchTerm(value)
  let queryWithoutSpecies = ` ${original} `
  const species = new Set<string>()

  for (const { species: canonicalSpecies, alias } of SPECIES_SEARCH_ALIASES) {
    const normalizedAlias = normalizeSearchTerm(alias)
    if (!normalizedAlias) continue

    const escaped = escapeRegExp(normalizedAlias)
    const isAscii = /^[a-z0-9\s-]+$/i.test(normalizedAlias)
    const pattern = isAscii
      ? new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, 'i')
      : new RegExp(escaped)

    if (!pattern.test(queryWithoutSpecies)) continue
    species.add(normalizeSpeciesName(canonicalSpecies))
    queryWithoutSpecies = queryWithoutSpecies.replace(pattern, ' ')
  }

  const cleanedTargetQuery = stripStopwords(queryWithoutSpecies)
  const compactOriginal = compactSearchTerm(original)
  const normalizedCatalog = normalizeElisaCatalogNumber(compactOriginal || original)
  const catalogLike = Boolean(normalizedCatalog && normalizedCatalog.startsWith('LV'))

  return {
    original,
    species: [...species],
    speciesQueryValues: [...new Set([...species].flatMap(getSpeciesQueryValues))],
    targetQuery: cleanedTargetQuery || original,
    catalogQuery: normalizedCatalog || original,
    catalogLike,
  }
}

export function compactSearchTerm(value: string) {
  return normalizeSearchTerm(value)
    .replace(/[\s_-]+/g, '')
    .trim()
}

export function buildSearchTermVariants(value: string) {
  const base = normalizeSearchTerm(value)
  if (!base) return []

  const variants = new Set<string>([base])
  const addTargetHyphenVariants = (term: string) => {
    const normalized = normalizeSearchTerm(term)
    const compact = compactSearchTerm(normalized)
    if (!compact) return

    variants.add(compact)

    const letterNumber = compact.match(/^([a-zA-Z]+)(\d+[a-zA-Z]?)$/)
    if (letterNumber) {
      variants.add(`${letterNumber[1]}-${letterNumber[2]}`)
      variants.add(`${letterNumber[1]} ${letterNumber[2]}`)
    }

    const letterRoman = compact.match(/^([a-zA-Z]+)([ivx]{1,4})$/i)
    const romanNumber = letterRoman ? romanToNumber(letterRoman[2]) : null
    if (letterRoman && romanNumber != null) {
      variants.add(`${letterRoman[1]}-${letterRoman[2].toUpperCase()}`)
      variants.add(`${letterRoman[1]} ${letterRoman[2].toUpperCase()}`)
      variants.add(`${letterRoman[1]}-${romanNumber}`)
      variants.add(`${letterRoman[1]} ${romanNumber}`)
      variants.add(`${letterRoman[1]}${romanNumber}`)
    }

    const numberLetter = compact.match(/^(\d+)([a-zA-Z]+)$/)
    if (numberLetter) {
      variants.add(`${numberLetter[1]}-${numberLetter[2]}`)
      variants.add(`${numberLetter[1]} ${numberLetter[2]}`)
    }

    const letterGreek = compact.match(/^([a-zA-Z]+)([αβγδεζηθκλμπρστφχω])(\d*)$/)
    if (letterGreek) {
      for (const suffix of greekSuffixVariants(letterGreek[2])) {
        const token = `${suffix}${letterGreek[3] || ''}`
        variants.add(`${letterGreek[1]}-${token}`)
        variants.add(`${letterGreek[1]} ${token}`)
        variants.add(`${letterGreek[1]}${token}`)
      }
    }

    const letterNumberGreek = compact.match(/^([a-zA-Z]+)(\d+)([αβγδεζηθκλμπρστφχω])$/)
    if (letterNumberGreek) {
      for (const suffix of greekSuffixVariants(letterNumberGreek[3])) {
        variants.add(`${letterNumberGreek[1]}-${letterNumberGreek[2]}${suffix}`)
        variants.add(`${letterNumberGreek[1]}-${letterNumberGreek[2]}-${suffix}`)
        variants.add(`${letterNumberGreek[1]} ${letterNumberGreek[2]} ${suffix}`)
        variants.add(`${letterNumberGreek[1]}${letterNumberGreek[2]}${suffix}`)
      }
    }
  }

  addTargetHyphenVariants(base)
  addTargetHyphenVariants(replaceChineseNumbers(base))
  addChineseTargetAliases(base, variants)

  for (const [symbol, words] of GREEK_WORDS) {
    if (base.includes(symbol)) {
      for (const word of words) {
        variants.add(base.replaceAll(symbol, word))
        variants.add(base.replaceAll(symbol, `-${word}`))
        addTargetHyphenVariants(base.replaceAll(symbol, word))
      }
    }

    for (const word of words) {
      const wordPattern = new RegExp(word, 'gi')
      if (wordPattern.test(base)) {
        variants.add(base.replace(wordPattern, symbol))
        addTargetHyphenVariants(base.replace(wordPattern, symbol))
      }
    }
  }

  for (const variant of [...variants]) {
    if (variant.includes('-')) variants.add(variant.replace(/-/g, ' '))
    if (variant.includes(' ')) variants.add(variant.replace(/\s+/g, '-'))
  }

  const compact = compactSearchTerm(base)
  if (compact && compact !== base) variants.add(compact)
  const arabicNumberVariant = replaceChineseNumbers(base)
  if (arabicNumberVariant !== base) {
    variants.add(arabicNumberVariant)
    addTargetHyphenVariants(arabicNumberVariant)
  }
  const normalizedCatalog = normalizeElisaCatalogNumber(compact || base)
  if (normalizedCatalog && normalizedCatalog !== compact && normalizedCatalog !== base) {
    variants.add(normalizedCatalog)
  }

  return unique([...variants]).slice(0, 40)
}

export function buildProductSearchOrConditions(
  value: string,
  fields: string[] = ['name', 'target', 'catalog_number', 'cat_no']
) {
  const variants = buildSearchTermVariants(value)
  return variants.flatMap((variant) =>
    fields.map((field) => `${field}.ilike.%${variant}%`)
  )
}

export function buildExactProductSearchValues(value: string) {
  const variants = buildSearchTermVariants(value)
  const exactValues = new Set<string>()
  for (const variant of variants) {
    exactValues.add(variant)
    exactValues.add(variant.toUpperCase())
    exactValues.add(variant.toLowerCase())
  }

  const compact = compactSearchTerm(value)
  const normalizedCatalog = normalizeElisaCatalogNumber(compact || value)
  if (normalizedCatalog) exactValues.add(normalizedCatalog)

  return [...exactValues].filter(Boolean).slice(0, 60)
}
