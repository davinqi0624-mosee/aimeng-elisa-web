import { existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import JSZip from 'jszip'

const templateDir = path.join(process.cwd(), 'project-materials', '02-product-data', 'datasheet-templates')
const sourcePath = path.join(templateDir, 'LV30300 Mouse IL-1β.docx')
const outputPath = path.join(templateDir, 'AIMENG_ELISA_datasheet_template_v1.0.docx')
const shouldOverwrite = process.env.OVERWRITE_DATASHEET_TEMPLATE === '1'

if (existsSync(outputPath) && !shouldOverwrite) {
  console.error(`${outputPath} already exists. Set OVERWRITE_DATASHEET_TEMPLATE=1 to rebuild it.`)
  process.exit(1)
}

function textContent(xml) {
  return xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function replaceText(xml, from, to) {
  return xml.split(from).join(to)
}

function makeRun(text) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="宋体" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>${text}</w:t></w:r>`
}

function replaceParagraphByText(xml, predicates, replacement) {
  return xml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = textContent(paragraph)
    if (!predicates.every((predicate) => text.includes(predicate))) return paragraph
    const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/)
    const pPr = pPrMatch ? pPrMatch[0] : ''
    const openMatch = paragraph.match(/^<w:p\b[^>]*>/)
    const open = openMatch ? openMatch[0] : '<w:p>'
    return `${open}${pPr}${makeRun(replacement)}</w:p>`
  })
}

const zip = await JSZip.loadAsync(readFileSync(sourcePath))
const xmlFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/') && name.endsWith('.xml'))

for (const xmlFile of xmlFiles) {
  const file = zip.file(xmlFile)
  const xml = await file?.async('text')
  if (!file || !xml) continue

  let nextXml = xml
  nextXml = replaceParagraphByText(nextXml, ['Mouse IL-1', 'Elisa Kit'], '{{species}} {{target_name}} ELISA Kit')
  nextXml = replaceText(nextXml, 'LV30300', '{{catalog_number}}')
  nextXml = replaceText(nextXml, '小鼠', '{{species_cn}}')
  nextXml = replaceText(nextXml, '15.6–1000pg/ml', '{{detection_range}}')
  nextXml = replaceText(nextXml, '15.6-1000pg/ml', '{{detection_range}}')
  nextXml = replaceText(nextXml, '3.1pg/ml', '{{sensitivity}}')
  nextXml = replaceText(nextXml, 'IL-1β', '{{target_name}}')
  nextXml = replaceText(nextXml, 'Mouse IL-1β', '{{species}} {{target_name}}')

  zip.file(xmlFile, nextXml)
}

const output = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 6 },
})

writeFileSync(outputPath, output)
console.log(`Generated ${outputPath}`)
