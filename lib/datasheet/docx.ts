import { readFileSync } from 'fs'
import JSZip from 'jszip'
import { buildDatasheetEnglishFields, containsCjk, isMostlyEnglish } from './english'
import { DATASHEET_SECTION_KEYS } from './sections'
import type { DatasheetTemplateStatus } from './templates'

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r?\n/g, '&#10;')
}

function replaceAll(value: string, search: string, replacement: string) {
  return value.split(search).join(replacement)
}

function replaceSplitDocxPlaceholder(xml: string, key: string, replacement: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const textTagRe = new RegExp(
    `<w:t([^>]*)>\\{<\\/w:t>(?:(?!<w:t).)*?<w:t([^>]*)>\\{${escapedKey}\\}\\}<\\/w:t>`,
    'gs'
  )

  return xml.replace(textTagRe, (_match, firstAttrs) => {
    return `<w:t${firstAttrs}>${replacement}</w:t>`
  })
}

function injectTargetIntroAfterLabel(xml: string, targetIntro: unknown) {
  const intro = String(targetIntro ?? '').trim()
  if (!intro) return xml

  return xml.replace(/(>[^<]*简介[：:]?)(<\/w:t>)/, (_match, label, closeTag) => {
    return `${label}${escapeXml(intro)}${closeTag}`
  })
}

function textRun(value: unknown, options: { bold?: boolean } = {}) {
  const text = String(value ?? '')
  const space = /^\s|\s$|\s{2,}/.test(text) ? ' xml:space="preserve"' : ''
  const bold = options.bold ? '<w:b/><w:bCs/>' : ''
  return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bold}<w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

function replaceParagraphByNeedle(xml: string, needle: string, bodyXml: string) {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    if (!paragraph.includes(needle)) return paragraph
    const openTag = paragraph.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>'
    const paragraphProps = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || ''
    return `${openTag}${paragraphProps}${bodyXml}</w:p>`
  })
}

function englishOverride(value: unknown, fallback: string) {
  const text = String(value ?? '').trim()
  if (!text || containsCjk(text) || !isMostlyEnglish(text)) return fallback
  return text
}

function hardenEnglishCoverPage(
  xml: string,
  datasheet: DatasheetDocxData,
  content: Record<string, unknown>,
  replacements: Record<string, unknown>
) {
  const englishFields = buildDatasheetEnglishFields({
    target: datasheet.target,
    species: datasheet.species,
    sampleTypes: content.sample_types,
    targetIntro: content.target_intro_en || content.target_intro,
  })
  const reactivity = String(replacements.reactivity_en || englishFields.reactivity_en)
  const specificity = englishOverride(replacements.specificity_en, englishFields.specificity_en)
  const application = englishOverride(replacements.application_en, englishFields.application_en)
  const targetIntro = englishOverride(replacements.target_intro_en, englishFields.target_intro_en)

  let nextXml = xml
  nextXml = replaceParagraphByNeedle(nextXml, 'Reactivity:', textRun('Reactivity: ', { bold: true }) + textRun(reactivity))
  nextXml = replaceParagraphByNeedle(nextXml, 'Specificity:', textRun('Specificity:', { bold: true }) + textRun(` ${specificity}`))
  nextXml = replaceParagraphByNeedle(nextXml, 'Application:', textRun('Application:', { bold: true }) + textRun(` ${application}`))
  nextXml = replaceParagraphByNeedle(
    nextXml,
    'qualitative',
    textRun('Application:', { bold: true }) + textRun(` ${application}`)
  )

  if (nextXml.includes('Interleukin-1beta') || nextXml.includes('IL-1beta')) {
    nextXml = nextXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
      if (!paragraph.includes('Interleukin-1beta') && !paragraph.includes('IL-1beta')) return paragraph
      const openTag = paragraph.match(/^<w:p\b[^>]*>/)?.[0] || '<w:p>'
      const paragraphProps = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)?.[0] || ''
      return `${openTag}${paragraphProps}${textRun(targetIntro ? 'Introduction:' : 'Introduction: ', { bold: true })}${targetIntro ? textRun(` ${targetIntro}`) : ''}</w:p>`
    })
  }

  return nextXml
}

export type DatasheetDocxData = {
  title: string
  target: string
  species: string
  method: string
  catalog_number: string
  size: string
  content: Record<string, unknown>
}

export async function renderDatasheetDocx(template: DatasheetTemplateStatus, datasheet: DatasheetDocxData) {
  const zip = await JSZip.loadAsync(readFileSync(template.path))
  const content = datasheet.content || {}
  const hasTargetIntroPlaceholder = template.placeholders.includes('{{target_intro}}')
  const englishFields = buildDatasheetEnglishFields({
    target: datasheet.target,
    species: datasheet.species,
    sampleTypes: content.sample_types,
    targetIntro: content.target_intro_en || content.target_intro,
  })
  const replacements: Record<string, unknown> = {
    catalog_number: datasheet.catalog_number,
    product_name: datasheet.title,
    target_name: datasheet.target,
    species: datasheet.species,
    species_en: datasheet.species,
    reactivity_en: content.reactivity_en || englishFields.reactivity_en,
    specificity_en: englishOverride(content.specificity_en, englishFields.specificity_en),
    application_en: englishOverride(content.application_en, englishFields.application_en),
    species_cn: content.species_cn,
    method: datasheet.method,
    size: content.display_size || '96T/48T',
    species_code: content.species_code,
    catalog_serial: content.catalog_serial,
    detection_range: content.detection_range,
    sensitivity: content.sensitivity,
    sample_types: content.sample_types,
    target_intro: content.target_intro,
    target_intro_en: englishOverride(content.target_intro_en, englishFields.target_intro_en),
    ...Object.fromEntries(DATASHEET_SECTION_KEYS.map((key) => [key, content[key]])),
  }

  const xmlFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/') && name.endsWith('.xml'))
  for (const xmlFile of xmlFiles) {
    const file = zip.file(xmlFile)
    const xml = await file?.async('text')
    if (!file || !xml) continue

    let nextXml = xml
    for (const [key, value] of Object.entries(replacements)) {
      const replacement = escapeXml(value)
      nextXml = replaceAll(nextXml, `{{${key}}}`, replacement)
      nextXml = replaceSplitDocxPlaceholder(nextXml, key, replacement)
    }
    if (!hasTargetIntroPlaceholder) {
      nextXml = injectTargetIntroAfterLabel(nextXml, content.target_intro)
    }
    nextXml = hardenEnglishCoverPage(nextXml, datasheet, content, replacements)
    zip.file(xmlFile, nextXml)
  }

  return zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
}
