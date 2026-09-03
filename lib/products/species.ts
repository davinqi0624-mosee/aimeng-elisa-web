export const SPECIES_ORDER = [
  'Human',
  'Mouse',
  'Rat',
  'Monkey',
  'Canine',
  'Porcine',
  'Bovine',
  'Chicken',
  'Guinea Pig',
  'Sheep',
  'Zebrafish',
  'Rabbit',
  'Goat',
]

export const SPECIES_LABELS: Record<string, string> = {
  Human: '人 / Human',
  Mouse: '小鼠 / Mouse',
  Rat: '大鼠 / Rat',
  Rabbit: '兔 / Rabbit',
  Chicken: '鸡 / Chicken',
  Porcine: '猪 / Porcine',
  Bovine: '牛 / Bovine',
  Monkey: '猴 / Monkey',
  Canine: '犬 / Canine',
  Cat: '猫 / Cat',
  Sheep: '绵羊 / Sheep',
  Horse: '马 / Horse',
  Goat: '山羊 / Goat',
  'Guinea Pig': '豚鼠 / Guinea Pig',
  Hamster: '仓鼠 / Hamster',
  Fish: '鱼 / Fish',
  Zebrafish: '斑马鱼 / Zebrafish',
  Duck: '鸭 / Duck',
  Pigeon: '鸽 / Pigeon',
  Plant: '植物 / Plant',
  General: '通用 / General',
}

export const SPECIES_QUERY_VALUES: Record<string, string[]> = {
  Human: ['Human', '人'],
  Mouse: ['Mouse', '小鼠'],
  Rat: ['Rat', '大鼠'],
  Rabbit: ['Rabbit', '兔'],
  Chicken: ['Chicken', '鸡'],
  Porcine: ['Porcine', '猪'],
  Bovine: ['Bovine', '牛', 'Cow'],
  Monkey: ['Monkey', '猴'],
  Canine: ['Canine', 'Dog', '犬'],
  Cat: ['Cat', '猫'],
  Sheep: ['Sheep', '绵羊'],
  Horse: ['Horse', '马'],
  Goat: ['Goat', 'Capra-hircus', 'Capra hircus', '山羊'],
  'Guinea Pig': ['Guinea Pig', 'Guinea-Pig', 'guinea pig', '豚鼠'],
  Hamster: ['Hamster', '仓鼠'],
  Fish: ['Fish', '鱼'],
  Zebrafish: ['Zebrafish', 'zebrafish', '斑马鱼'],
  Duck: ['Duck', '鸭'],
  Pigeon: ['Pigeon', '鸽'],
  Plant: ['Plant', '植物'],
  General: ['General', '通用'],
}

export const SPECIES_NAME_PATTERNS: Record<string, string[]> = {
  Human: ['Human', '人'],
  Mouse: ['Mouse', '小鼠'],
  Rat: ['Rat', '大鼠'],
  Rabbit: ['Rabbit', '兔'],
  Chicken: ['Chicken', '鸡'],
  Porcine: ['Porcine', '猪'],
  Bovine: ['Bovine', '牛', 'Cow'],
  Monkey: ['Monkey', '猴'],
  Canine: ['Canine', 'Dog', '犬'],
  Cat: ['Cat', '猫'],
  Sheep: ['Sheep', '绵羊'],
  Horse: ['Horse', '马'],
  Goat: ['Goat', 'Capra-hircus', 'Capra hircus', '山羊'],
  'Guinea Pig': ['Guinea Pig', 'Guinea-Pig', '豚鼠'],
  Hamster: ['Hamster', '仓鼠'],
  Fish: ['Fish', '鱼'],
  Zebrafish: ['Zebrafish', '斑马鱼'],
  Duck: ['Duck', '鸭'],
  Pigeon: ['Pigeon', '鸽'],
  Plant: ['Plant', '植物'],
  General: ['General', '通用'],
}

const SPECIES_ALIASES = new Map<string, string>()

for (const species of Object.keys(SPECIES_LABELS)) {
  SPECIES_ALIASES.set(species.toLowerCase(), species)
  for (const value of SPECIES_QUERY_VALUES[species] || []) {
    SPECIES_ALIASES.set(value.toLowerCase(), species)
  }
}

export function normalizeSpeciesName(value?: string | null) {
  const text = (value || '').normalize('NFKC').trim()
  if (!text) return ''
  return SPECIES_ALIASES.get(text.toLowerCase()) || text
}

export function getSpeciesQueryValues(species: string) {
  const canonical = normalizeSpeciesName(species)
  return Array.from(new Set([canonical, ...(SPECIES_QUERY_VALUES[canonical] || [species])].filter(Boolean)))
}

export function normalizeSpeciesList(values: Array<string | null | undefined>) {
  const seen = new Set<string>()
  const result: string[] = []

  for (const value of values) {
    const species = normalizeSpeciesName(value)
    if (!species || seen.has(species)) continue
    seen.add(species)
    result.push(species)
  }

  return result
}

export function getSpeciesLabel(species?: string | null) {
  const canonical = normalizeSpeciesName(species)
  return SPECIES_LABELS[canonical] || canonical || ''
}
