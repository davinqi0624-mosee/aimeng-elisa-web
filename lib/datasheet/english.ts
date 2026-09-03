function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

export function isMostlyEnglish(value: string) {
  if (!value) return false
  const letters = value.match(/[A-Za-z]/g)?.length || 0
  const cjk = value.match(/[\u3400-\u9fff]/g)?.length || 0
  return letters > 20 && letters >= cjk * 2
}

function englishOrFallback(value: unknown, fallback: string) {
  const text = normalizeText(value)
  if (!text || containsCjk(text) || !isMostlyEnglish(text)) return fallback
  return text
}

export type DatasheetEnglishFieldInput = {
  target: string
  species: string
  sampleTypes?: unknown
  targetIntro?: unknown
}

export function buildDatasheetEnglishFields(input: DatasheetEnglishFieldInput) {
  const target = normalizeText(input.target) || 'target protein'
  const species = normalizeText(input.species) || 'the indicated species'
  const sampleTypes = englishOrFallback(
    input.sampleTypes,
    'serum, plasma, tissue homogenate, cell culture supernatant and other biological fluids'
  )
  const providedIntro = normalizeText(input.targetIntro)
  const targetIntroEn = isMostlyEnglish(providedIntro) && !containsCjk(providedIntro)
    ? providedIntro
    : ''

  return {
    reactivity_en: species,
    specificity_en: `It can detect ${species} ${target} in samples and has no obvious cross reaction with its analogues.`,
    application_en: `This kit is used for qualitative or quantitative in vitro research analysis of ${target} in ${sampleTypes}. It is for scientific research use only and not for clinical diagnosis.`,
    target_intro_en: targetIntroEn,
  }
}
