import { createClient } from '@/lib/supabase/server'
import {
  getSerumProduct,
  getSerumProductsByCategory,
  type SerumCategory,
  type SerumProduct,
} from '@/lib/products/serum-products'

type SerumProductRow = {
  slug: string
  category: SerumCategory
  name: string
  english_name: string | null
  catalog_number: string | null
  origin: string | null
  serum_type: string | null
  package_size: string | null
  image_url: string | null
  summary: string | null
  description: string[] | null
  applications: string[] | null
  quality_items: Array<{ label: string; value: string }> | null
  cell_applications: string[] | null
  comparison_points: Array<{ label: string; aimeng: string; common: string }> | null
}

function mapSerumProduct(row: SerumProductRow): SerumProduct {
  return {
    slug: row.slug,
    category: row.category,
    name: row.name,
    englishName: row.english_name || '',
    catalogNumber: row.catalog_number || '',
    origin: row.origin || '',
    serumType: row.serum_type || '',
    packageSize: row.package_size || '',
    imageUrl: row.image_url || '/images/elisa/elisa_full_workflow_vertical.jpg',
    summary: row.summary || '',
    description: row.description || [],
    applications: row.applications || [],
    qualityItems: row.quality_items || [],
    cellApplications: row.cell_applications || [],
    comparisonPoints: row.comparison_points || undefined,
  }
}

export async function getPublishedSerumProductsByCategory(category: SerumCategory) {
  const result = await getPublishedSerumProductsByCategoryWithSource(category)
  return result.products
}

export async function getPublishedSerumProductsByCategoryWithSource(category: SerumCategory): Promise<{
  products: SerumProduct[]
  source: 'database' | 'fallback'
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('serum_products')
    .select('*')
    .eq('category', category)
    .eq('status', 'active')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error || !data || data.length === 0) {
    return { products: getSerumProductsByCategory(category), source: 'fallback' }
  }

  return { products: (data as SerumProductRow[]).map(mapSerumProduct), source: 'database' }
}

export async function getPublishedSerumProduct(slug: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('serum_products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (error || !data) {
    return getSerumProduct(slug)
  }

  return mapSerumProduct(data as SerumProductRow)
}
