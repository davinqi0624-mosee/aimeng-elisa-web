import * as XLSX from 'xlsx'
import JSZip from 'jszip'

export interface ExcelImage {
  row: number
  col: number
  blob: Blob
  filename: string
}

function getAttributeByLocalName(el: Element, localName: string): string | null {
  for (let i = 0; i < el.attributes.length; i++) {
    if (el.attributes[i].localName === localName) {
      return el.attributes[i].value
    }
  }
  return null
}

async function extractImagesFromXLSX(arrayBuffer: ArrayBuffer): Promise<ExcelImage[]> {
  const zip = await JSZip.loadAsync(arrayBuffer)
  const images: ExcelImage[] = []

  const workbookXmlFile = zip.file('xl/workbook.xml')
  const workbookRelsFile = zip.file('xl/_rels/workbook.xml.rels')
  if (!workbookXmlFile || !workbookRelsFile) return images

  // Parse workbook.xml to get sheet name -> r:id mapping
  const workbookXml = await workbookXmlFile.async('text')
  const workbookDoc = new DOMParser().parseFromString(workbookXml, 'application/xml')
  const sheetEls = Array.from(workbookDoc.querySelectorAll('sheet'))
  const sheetNameToRid = new Map<string, string>()
  for (const sheetEl of sheetEls) {
    const name = sheetEl.getAttribute('name')
    const rid = getAttributeByLocalName(sheetEl, 'id')
    if (name && rid) sheetNameToRid.set(name, rid)
  }

  // Parse workbook.xml.rels to map r:id -> worksheet Target
  const workbookRelsXml = await workbookRelsFile.async('text')
  const workbookRelsDoc = new DOMParser().parseFromString(workbookRelsXml, 'application/xml')
  const ridToTarget = new Map<string, string>()
  for (const rel of Array.from(workbookRelsDoc.querySelectorAll('Relationship'))) {
    const id = rel.getAttribute('Id')
    const target = rel.getAttribute('Target')
    const type = rel.getAttribute('Type') || ''
    if (id && target && type.includes('worksheet')) {
      ridToTarget.set(id, target)
    }
  }

  // Build sheet name -> worksheet file mapping
  const sheetNameToFile = new Map<string, string>()
  for (const [name, rid] of sheetNameToRid) {
    const target = ridToTarget.get(rid)
    if (target) sheetNameToFile.set(name, target)
  }

  // Process images from all sheets (we'll filter by sheet later if needed)
  for (const [, sheetFile] of sheetNameToFile) {
    const sheetRelsPath = `xl/worksheets/_rels/${sheetFile.replace('worksheets/', '')}.rels`
    const relsFile = zip.file(sheetRelsPath)
    if (!relsFile) continue

    const relsXml = await relsFile.async('text')
    const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml')
    const relationships = Array.from(relsDoc.querySelectorAll('Relationship'))

    const drawingRel = relationships.find(r =>
      (r.getAttribute('Type') || '').includes('drawing')
    )
    if (!drawingRel) continue

    const drawingTarget = drawingRel.getAttribute('Target') || ''
    const drawingPath = drawingTarget.startsWith('../')
      ? `xl/${drawingTarget.substring(3)}`
      : `xl/worksheets/${drawingTarget}`

    const drawingFile = zip.file(drawingPath)
    if (!drawingFile) continue

    // Parse drawing rels to map rId -> media Target
    const drawingRelsPath = drawingPath
      .replace(/^xl\/drawings\//, 'xl/drawings/_rels/')
      .replace(/\.xml$/, '.xml.rels')
    const drawingRelsFile = zip.file(drawingRelsPath)
    const drawingRelsMap = new Map<string, string>()
    if (drawingRelsFile) {
      const drawingRelsXml = await drawingRelsFile.async('text')
      const drawingRelsDoc = new DOMParser().parseFromString(drawingRelsXml, 'application/xml')
      for (const r of Array.from(drawingRelsDoc.querySelectorAll('Relationship'))) {
        drawingRelsMap.set(r.getAttribute('Id') || '', r.getAttribute('Target') || '')
      }
    }

    // Parse drawing XML
    const drawingXml = await drawingFile.async('text')
    const drawingDoc = new DOMParser().parseFromString(drawingXml, 'application/xml')
    const anchors = drawingDoc.querySelectorAll('twoCellAnchor, oneCellAnchor')

    for (const anchor of Array.from(anchors)) {
      const from = anchor.querySelector('from')
      if (!from) continue

      const colEl = from.querySelector('col')
      const rowEl = from.querySelector('row')
      if (!colEl?.textContent || !rowEl?.textContent) continue

      const col = parseInt(colEl.textContent, 10)
      const row = parseInt(rowEl.textContent, 10)

      const blip = anchor.querySelector('blip')
      if (!blip) continue

      const embed = getAttributeByLocalName(blip, 'embed')
      if (!embed) continue

      const mediaTarget = drawingRelsMap.get(embed)
      if (!mediaTarget) continue

      const mediaPath = mediaTarget.startsWith('../')
        ? `xl/${mediaTarget.substring(3)}`
        : `xl/drawings/${mediaTarget}`

      const mediaFile = zip.file(mediaPath)
      if (!mediaFile) continue

      const blob = await mediaFile.async('blob')
      const filename = mediaPath.split('/').pop() || 'image.png'

      images.push({ row, col, blob, filename })
    }
  }

  return images
}

export async function readExcelWithImages(file: File): Promise<{
  rows: any[][]
  images: ExcelImage[]
}> {
  const data = await file.arrayBuffer()

  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = workbook.SheetNames.find(s => s.toLowerCase() === 'products') || workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  const images = await extractImagesFromXLSX(data)

  return { rows, images }
}

export function generateExcelTemplate(): void {
  const wb = XLSX.utils.book_new()
  const wsData = [
    ['catalog_number', 'product_name', 'target', 'detection_range', 'sensitivity', 'size', 'price', 'stock_status', 'status', 'product_image', 'standard_curve_image', 'validation_image', 'additional_image'],
    ['AU-IL6-96T', 'Mouse IL-6 Elisa Kit', 'IL-6', '7.8-500 pg/mL', '3.9 pg/mL', '96T', 1800, '有货', '上架', '在此单元格嵌入图片 (600×600)', '在此单元格嵌入图片 (800×400)', '在此单元格嵌入图片 (800×400)', '在此单元格嵌入图片 (600×400)'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  ws['!cols'] = [
    { wch: 18 }, { wch: 28 }, { wch: 15 }, { wch: 22 }, { wch: 15 }, { wch: 8 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 32 }, { wch: 32 }, { wch: 32 }, { wch: 32 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, 'Products')
  XLSX.writeFile(wb, 'product_import_template.xlsx')
}
