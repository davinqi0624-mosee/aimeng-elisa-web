import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'
import JSZip from 'jszip'

export const DATASHEET_TEMPLATE_DIR = path.join(
  process.cwd(),
  'project-materials',
  '02-product-data',
  'datasheet-templates'
)

export type DatasheetTemplateStatus = {
  fileName: string
  path: string
  sizeBytes: number
  updatedAt: string
  hasPlaceholders: boolean
  placeholders: string[]
  isSample: boolean
  role: 'work_template' | 'complete_sample'
}

const PLACEHOLDER_RE = /\{\{[a-zA-Z0-9_#\/.-]+\}\}/g

function isUsableDocxTemplate(fileName: string) {
  if (!fileName.toLowerCase().endsWith('.docx')) return false
  if (fileName.startsWith('~$') || fileName.startsWith('.')) return false

  try {
    return statSync(path.join(DATASHEET_TEMPLATE_DIR, fileName)).isFile()
  } catch {
    return false
  }
}

export async function inspectDocxTemplate(fileName: string): Promise<DatasheetTemplateStatus> {
  const fullPath = path.join(DATASHEET_TEMPLATE_DIR, fileName)
  const stat = statSync(fullPath)
  let placeholders: string[] = []

  try {
    const zip = await JSZip.loadAsync(readFileSync(fullPath))
    const xmlFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/') && name.endsWith('.xml'))
    const found = new Set<string>()
    for (const xmlFile of xmlFiles) {
      const xml = await zip.file(xmlFile)?.async('text')
      if (!xml) continue
      for (const match of xml.matchAll(PLACEHOLDER_RE)) found.add(match[0])
    }
    placeholders = Array.from(found).sort()
  } catch {
    placeholders = []
  }

  const isSample = /^LV\d+/i.test(fileName)

  return {
    fileName,
    path: fullPath,
    sizeBytes: stat.size,
    updatedAt: stat.mtime.toISOString(),
    hasPlaceholders: placeholders.length > 0,
    placeholders,
    isSample,
    role: isSample ? 'complete_sample' : 'work_template',
  }
}

export async function listDatasheetTemplates() {
  if (!existsSync(DATASHEET_TEMPLATE_DIR)) return []

  const files = readdirSync(DATASHEET_TEMPLATE_DIR)
    .filter(isUsableDocxTemplate)
    .sort((a, b) => {
      const aIsSample = /^LV\d+/i.test(a)
      const bIsSample = /^LV\d+/i.test(b)
      if (aIsSample !== bIsSample) return aIsSample ? 1 : -1
      return a.localeCompare(b)
    })

  return Promise.all(files.map((file) => inspectDocxTemplate(file)))
}

export async function getPreferredDatasheetTemplate() {
  const templates = await listDatasheetTemplates()
  return (
    templates.find((template) => template.role === 'work_template' && template.hasPlaceholders) ||
    templates.find((template) => template.role === 'work_template') ||
    templates[0] ||
    null
  )
}
