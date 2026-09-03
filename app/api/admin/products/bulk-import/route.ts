import { NextRequest, NextResponse } from 'next/server'
import { requireAdminOrSuper } from '@/lib/admin/auth'
import { getClientIP } from '@/lib/admin/permissions'
import { logAudit } from '@/lib/admin/audit'
import { generateProductSlug } from '@/lib/products'
import { catalogNumberVariants, normalizeElisaCatalogNumber } from '@/lib/products/catalog'
import { normalizeSpeciesName } from '@/lib/products/species'
import { createAdminClient } from '@/lib/supabase/admin'

type ImportProduct = {
  name?: string
  target?: string
  catalog_number?: string
  species?: string
  description?: string
  detection_method?: string
  assay_time?: string
  platform?: string
  sample_types_text?: string
  detection_range?: string
  sensitivity?: string
  size?: string
  price?: number
  price_48t?: number | null
  price_96t?: number | null
  stock_status?: string
  status?: string
}

type ExistingProductCatalog = {
  catalog_number?: string | null
  cat_no?: string | null
}

type InsertedProductRow = {
  id: string
}

type ImportedProductRow = {
  name: string
  target: string
  catalog_number?: string | null
  cat_no?: string | null
  species?: string | null
  description?: string | null
  detection_method?: string | null
  assay_time?: string | null
  platform?: string | null
  sample_types_text?: string | null
  detection_range?: string | null
  sensitivity?: string | null
  size?: string | null
  price: number
  price_48t?: number | null
  price_96t?: number | null
  stock_status: string
  status: string
  slug: string
}

const OPTIONAL_COLUMN_NAMES = [
  'catalog_number',
  'cat_no',
  'species',
  'description',
  'detection_method',
  'assay_time',
  'platform',
  'sample_types_text',
  'size',
  'price_48t',
  'price_96t',
]

const SPECIES_PATTERNS: Record<string, string[]> = {
  Human: ['Human', '人'],
  Mouse: ['Mouse', '小鼠'],
  Rat: ['Rat', '大鼠'],
  Rabbit: ['Rabbit', '兔'],
  Chicken: ['Chicken', '鸡'],
  Porcine: ['Porcine', '猪'],
  Bovine: ['Bovine', '牛', 'Cow'],
  Monkey: ['Monkey', '猴'],
  Canine: ['Canine', 'Dog', '犬', '狗'],
  Sheep: ['Sheep', '绵羊'],
  Goat: ['Goat', 'Capra-hircus', 'Capra hircus', '山羊'],
  'Guinea Pig': ['Guinea Pig', 'Guinea-Pig', '豚鼠'],
  Zebrafish: ['Zebrafish', '斑马鱼'],
}

const SPECIES_NAME_ZH: Record<string, string> = {
  Human: '人',
  Mouse: '小鼠',
  Rat: '大鼠',
  Rabbit: '兔',
  Chicken: '鸡',
  Porcine: '猪',
  Bovine: '牛',
  Monkey: '猴',
  Canine: '犬',
  Sheep: '绵羊',
  Goat: '山羊',
  'Guinea Pig': '豚鼠',
  Zebrafish: '斑马鱼',
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeStockStatus(value?: string) {
  const text = cleanText(value).toLowerCase()
  if (!text || text === '有货' || text === '现货' || text === 'in_stock' || text === 'instock') return 'in_stock'
  if (text === '库存紧张' || text === '少量' || text === 'low_stock') return 'low_stock'
  if (text === '缺货' || text === '无货' || text === 'out_of_stock') return 'out_of_stock'
  return text
}

function normalizePublishStatus(value?: string) {
  const text = cleanText(value).toLowerCase()
  if (!text || text === '上架' || text === '已上架' || text === 'active') return 'active'
  if (text === '草稿' || text === 'draft') return 'draft'
  if (text === '归档' || text === '下架' || text === 'archived' || text === 'inactive') return 'archived'
  return text
}

function stripUnsupportedColumns<T extends object>(row: T, errorMessage: string): T {
  const copy = { ...row } as T & Record<string, unknown>
  for (const column of OPTIONAL_COLUMN_NAMES) {
    if (errorMessage.includes(column)) delete copy[column]
  }
  return copy as T
}

function getMissingOptionalColumn(errorMessage: string) {
  return OPTIONAL_COLUMN_NAMES.find((column) => errorMessage.includes(column))
}

function inferSpeciesFromName(name: string) {
  for (const [species, patterns] of Object.entries(SPECIES_PATTERNS)) {
    if (patterns.some((pattern) => name.toLowerCase().includes(pattern.toLowerCase()))) {
      return species
    }
  }
  return ''
}

export async function POST(request: NextRequest) {
  const { admin, error: authError } = await requireAdminOrSuper(request)
  if (authError) return authError

  const supabase = createAdminClient()

  try {
    const body = await request.json()
    const products = Array.isArray(body.products) ? body.products as ImportProduct[] : []

    if (products.length === 0) {
      return NextResponse.json({ error: '没有可导入的产品数据' }, { status: 400 })
    }
    if (products.length > 5000) {
      return NextResponse.json({ error: '单次最多导入 5000 条产品，请分批上传' }, { status: 400 })
    }

    const errors: string[] = []
    let rows = products
      .map((product, index) => {
        const name = cleanText(product.name)
        const target = cleanText(product.target)
        const catalogNumber = normalizeElisaCatalogNumber(cleanText(product.catalog_number))
        if (!name || !target || !catalogNumber) {
          const missingFields = [
            !name ? '产品名称' : '',
            !target ? '指标/靶标' : '',
            !catalogNumber ? '货号' : '',
          ].filter(Boolean).join('、')
          errors.push(`第 ${index + 2} 行：缺少${missingFields}`)
          return null
        }

        const species = normalizeSpeciesName(cleanText(product.species) || inferSpeciesFromName(name))
        const price48 = 1800
        const price96 = 2400
        const price = 2400

        return {
          name,
          target,
          catalog_number: catalogNumber || null,
          cat_no: catalogNumber || null,
          species: species || null,
          description: cleanText(product.description) || null,
          detection_method: cleanText(product.detection_method) || null,
          assay_time: cleanText(product.assay_time) || null,
          platform: cleanText(product.platform) || null,
          sample_types_text: cleanText(product.sample_types_text) || null,
          detection_range: cleanText(product.detection_range) || null,
          sensitivity: cleanText(product.sensitivity) || null,
          size: '48T / 96T',
          price,
          price_48t: price48,
          price_96t: price96,
          stock_status: normalizeStockStatus(product.stock_status),
          status: normalizePublishStatus(product.status),
          slug: generateProductSlug(name, target, catalogNumber),
        }
      })
      .filter(Boolean) as ImportedProductRow[]
    let failed = products.length - rows.length

    if (rows.length === 0) {
      return NextResponse.json({ error: errors[0] || '没有可导入的有效产品' }, { status: 400 })
    }

    const seenCatalogs = new Set<string>()
    rows = rows.filter((row) => {
      const catalog = cleanText(row.catalog_number)
      if (!catalog) return true
      const key = normalizeElisaCatalogNumber(catalog)
      if (seenCatalogs.has(key)) {
        failed += 1
        errors.push(`货号 ${catalog} 在本次导入文件中重复，已跳过`)
        return false
      }
      seenCatalogs.add(key)
      return true
    })

    const catalogNumbers = [...new Set(rows.map((row) => normalizeElisaCatalogNumber(row.catalog_number)).filter(Boolean))]
    if (catalogNumbers.length > 0) {
      const existingProducts: ExistingProductCatalog[] = []
      let existingErrorMessage = ''
      for (let index = 0; index < catalogNumbers.length; index += 200) {
        const chunk = catalogNumbers.slice(index, index + 200)
        const chunkWithLegacySuffixes = [...new Set(chunk.flatMap((catalog) => catalogNumberVariants(catalog)))]
        const byCatalog = await supabase
          .from('products')
          .select('catalog_number, cat_no')
          .in('catalog_number', chunkWithLegacySuffixes)
        const byCatNo = await supabase
          .from('products')
          .select('catalog_number, cat_no')
          .in('cat_no', chunkWithLegacySuffixes)
        if (byCatalog.error || byCatNo.error) {
          existingErrorMessage = byCatalog.error?.message || byCatNo.error?.message || '未知错误'
          break
        }
        existingProducts.push(...(byCatalog.data || []), ...(byCatNo.data || []))
      }
      if (existingErrorMessage) {
        errors.push(`重复货号检查失败：${existingErrorMessage}`)
      } else {
        const existingCatalogs = new Set(
          (existingProducts || [])
            .flatMap((item) => [item.catalog_number, item.cat_no])
            .map((value) => normalizeElisaCatalogNumber(value))
            .filter(Boolean)
        )
        if (existingCatalogs.size > 0) {
          const before = rows.length
          for (const row of rows) {
            const catalog = normalizeElisaCatalogNumber(row.catalog_number)
            if (catalog && existingCatalogs.has(catalog)) {
              errors.push(`货号 ${catalog} 已存在，已跳过，避免重复产品`)
            }
          }
          for (let i = rows.length - 1; i >= 0; i--) {
            const catalog = normalizeElisaCatalogNumber(rows[i].catalog_number)
            if (catalog && existingCatalogs.has(catalog)) rows.splice(i, 1)
          }
          failed += before - rows.length
        }
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({
        success: 0,
        failed,
        errors: errors.slice(0, 20),
        batchId: null,
      })
    }

    const batchId = crypto.randomUUID()
    const createdIds: string[] = []
    let success = 0

    for (let index = 0; index < rows.length; index += 100) {
      const chunk = rows.slice(index, index + 100)
      let insertChunk = chunk
      let data: InsertedProductRow[] | null = null
      let error: { message?: string } | null = null
      const strippedColumns = new Set<string>()

      for (let attempt = 0; attempt < OPTIONAL_COLUMN_NAMES.length + 1; attempt++) {
        const result = await supabase
          .from('products')
          .insert(insertChunk)
          .select('id')
        data = result.data
        error = result.error

        const errorMessage = error?.message || ''
        const missingColumn = getMissingOptionalColumn(errorMessage)
        if (!error || !missingColumn || strippedColumns.has(missingColumn)) {
          break
        }

        strippedColumns.add(missingColumn)
        insertChunk = insertChunk.map((row) => stripUnsupportedColumns(row, missingColumn))
      }

      if (error) {
        failed += chunk.length
        errors.push(`第 ${index + 2}-${index + chunk.length + 1} 行：${error.message}`)
        continue
      }

      success += data?.length || 0
      createdIds.push(...(data || []).map((row) => row.id))

      const speciesLinks = (data || [])
        .map((row, rowIndex) => {
          const species = chunk[rowIndex]?.species
          if (!species) return null
          return {
            product_id: row.id,
            species,
            species_name_zh: SPECIES_NAME_ZH[species] || species,
            is_primary: true,
          }
        })
        .filter((row): row is { product_id: string; species: string; species_name_zh: string; is_primary: boolean } => Boolean(row))

      if (speciesLinks.length > 0) {
        try {
          await supabase.from('product_species').insert(speciesLinks)
        } catch {
          // Product search also falls back to product.species/name, so this is not critical.
        }
      }
    }

    try {
      await supabase.from('bulk_import_batches').insert({
        id: batchId,
        type: 'products',
        product_count: success,
        image_count: 0,
        status: 'completed',
        user_id: admin!.id,
        details: {
          success,
          failed,
          errors: errors.slice(0, 20),
          created_ids: createdIds,
        },
      })
    } catch {
      // Batch history is useful but should not turn a successful import into a failure.
    }

    await logAudit({
      admin_id: admin!.id,
      action: 'bulk_import',
      target_table: 'products',
      target_id: batchId,
      new_value: { success, failed, total: products.length },
      ip_address: getClientIP(request),
    })

    return NextResponse.json({
      success,
      failed,
      errors: errors.slice(0, 20),
      batchId,
    })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message || '批量导入失败' : '批量导入失败' }, { status: 500 })
  }
}
