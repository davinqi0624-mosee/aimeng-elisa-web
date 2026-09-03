import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Breadcrumb from '@/components/ui/Breadcrumb'
import OrderPanel from '@/components/product/OrderPanel'
import ProductInfoCards from '@/components/product/ProductInfoCards'
import ProductAccordion from '@/components/product/ProductAccordion'
import ProductImageGallery from '@/components/product/ProductImageGallery'
import { getSpeciesLabel, normalizeSpeciesList } from '@/lib/products/species'

type ProductDocumentLink = {
  id: string
  document_type: 'datasheet' | 'coa'
  file_url: string
  file_name: string | null
}

type ProductGalleryImage = {
  url: string
  type: string
  label: string
}

type ProductImageRow = {
  image_url?: string | null
  image_type?: string | null
  display_order?: number | null
}

type ProductWithImages = {
  product_image?: string | null
  standard_curve_image?: string | null
  validation_image?: string | null
  additional_image?: string | null
  product_images?: ProductImageRow[] | null
}

type ProductMediaSettings = {
  product_ad_image_url?: string | null
  method_image_url?: string | null
}

const DEFAULT_PRODUCT_AD_IMAGE = '/images/elisa/elisa_sandwich_lego.jpg'
const DEFAULT_METHOD_IMAGE = '/images/elisa/elisa_sandwich_sketch.jpg'
const LEGACY_SEEDED_IMAGE_URLS = new Set([
  '/images/elisa/elisa_sandwich_sketch.jpg',
  '/images/elisa/elisa_sandwich_pencil.jpg',
  '/images/elisa/elisa_sandwich_lego.jpg',
  '/images/elisa/elisa_full_workflow_vertical.jpg',
])

const PRODUCT_IMAGE_LABELS: Record<string, string> = {
  product: '产品照片',
  product_ad: '产品展示',
  standard_curve: '标准曲线',
  validation: '验证数据',
  additional: '其他图片',
  reserved: '预留图片',
  parameters: '实验参数',
  principle: '检测原理',
  method: '检测方法',
}

function isMissingProductDocumentsTable(message?: string) {
  return Boolean(
    message?.includes('product_documents') &&
      (message.includes('schema cache') || message.includes('does not exist'))
  )
}

function normalizeSampleTypes(value: unknown): string | null {
  if (Array.isArray(value)) {
    const text = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .join('、')
    return text || null
  }

  if (typeof value !== 'string') return null

  const text = value.trim()
  if (!text) return null

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return normalizeSampleTypes(parsed)
    } catch {
      return text
    }
  }

  return text
}

function buildGalleryImages(product: ProductWithImages, mediaSettings?: ProductMediaSettings | null): ProductGalleryImage[] {
  const images: ProductGalleryImage[] = []
  const seenUrls = new Set<string>()
  const productAdImage = mediaSettings?.product_ad_image_url?.trim() || DEFAULT_PRODUCT_AD_IMAGE
  const methodImage = mediaSettings?.method_image_url?.trim() || DEFAULT_METHOD_IMAGE

  const addImage = (url: unknown, type: string, label?: string) => {
    const imageUrl = typeof url === 'string' ? url.trim() : ''
    if (!imageUrl || seenUrls.has(imageUrl)) return
    seenUrls.add(imageUrl)
    images.push({
      url: imageUrl,
      type,
      label: label || PRODUCT_IMAGE_LABELS[type] || '产品图片',
    })
  }

  // 第 1 位固定产品广告图，可被商品专属产品图覆盖。
  addImage(product.product_image || productAdImage, 'product_ad')
  addImage(product.standard_curve_image, 'standard_curve')
  // 第 3 位固定方法学图，可被商品专属验证/方法图覆盖。
  addImage(product.validation_image || methodImage, 'method')
  addImage(product.additional_image, 'additional')

  const relationImages = Array.isArray(product.product_images)
    ? [...(product.product_images as ProductImageRow[])].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      )
    : []

  for (const image of relationImages) {
    const type = image.image_type || 'additional'
    const imageUrl = typeof image.image_url === 'string' ? image.image_url.trim() : ''
    if (LEGACY_SEEDED_IMAGE_URLS.has(imageUrl)) continue
    addImage(image.image_url, type)
  }

  return images
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const decodedSlug = decodeURIComponent(slug)
  const supabase = await createClient()

  // Fetch product with all related data (defensive: try new columns, fall back if missing)
  const productQuery = supabase
    .from('products')
    .select(
      '*, product_species(species, species_name_zh, is_primary), product_aliases(alias, alias_type), product_images(image_url, image_type, display_order), cat_no, citation_count, product_image, standard_curve_image, validation_image, additional_image, datasheet_pdf, price_48t, price_96t, species, catalog_number'
    )
    .eq('slug', decodedSlug)
    .eq('status', 'active')

  const productResult = await productQuery.single()
  let product = productResult.data
  const productError = productResult.error

  // If new columns don't exist yet, fall back to base query
  if (productError && (productError.message?.includes('price_48t') || productError.message?.includes('price_96t') || productError.message?.includes('species'))) {
    const { data: fallbackProduct, error: fallbackError } = await supabase
      .from('products')
      .select(
        '*, product_species(species, species_name_zh, is_primary), product_aliases(alias, alias_type), product_images(image_url, image_type, display_order), cat_no, citation_count, product_image, standard_curve_image, validation_image, additional_image, datasheet_pdf, prices, catalog_number'
      )
      .eq('slug', decodedSlug)
      .eq('status', 'active')
      .single()

    if (fallbackError || !fallbackProduct) {
      notFound()
    }

    product = fallbackProduct
  }

  if (!product) {
    notFound()
  }

  const speciesRows = (product.product_species || []) as Array<{
    species?: string | null
    species_name_zh?: string | null
    is_primary?: boolean | null
  }>
  const speciesList = normalizeSpeciesList(speciesRows.map((s) => s.species))

  // Primary species for breadcrumb
  const primarySpeciesRow = speciesRows.find((s) => s.is_primary)
  const primarySpecies = normalizeSpeciesList([primarySpeciesRow?.species, speciesList[0]])[0]
  const primarySpeciesLabel = getSpeciesLabel(primarySpecies)

  // Fallback values when new columns don't exist yet
  const displaySpecies = normalizeSpeciesList([product.species, primarySpecies])[0] || undefined
  const displayPrice48t = product.price_48t ?? product.prices?.['48T'] ?? undefined
  const displayPrice96t = product.price_96t ?? product.prices?.['96T'] ?? undefined
  const displayCatNo = product.catalog_number || product.cat_no || '待确认'
  const displaySampleTypes = normalizeSampleTypes(
    product.sample_types || product.sample_type || product.sample_types_text
  )
  const displayDetectionMethod = product.detection_method || '双抗夹心法 (Sandwich ELISA)'
  const displayAssayTime = product.assay_time || '4h'
  const displayPlatform = product.platform || 'ELISA'
  let productMediaSettings: ProductMediaSettings | null = null
  const { data: mediaSettingsRow, error: mediaSettingsError } = await supabase
    .from('site_settings')
    .select('product_media')
    .eq('id', 1)
    .maybeSingle()
  if (!mediaSettingsError) {
    productMediaSettings = (mediaSettingsRow?.product_media || null) as ProductMediaSettings | null
  }
  const galleryImages = buildGalleryImages(product, productMediaSettings)

  // Fetch citations. Official imports can contain several catalog numbers in detected_products.
  const citationCatNo = product.cat_no || product.catalog_number
  let citations: Array<{
    id: string
    title: string
    authors: string | null
    journal: string | null
    doi: string | null
    impact_factor: number | null
    publication_date: string | null
  }> = []
  if (citationCatNo) {
    const [primaryCitationResult, detectedCitationResult] = await Promise.all([
      supabase
        .from('papers')
        .select('id, title, authors, journal, doi, impact_factor, publication_date')
        .eq('product_cat_no', citationCatNo)
        .eq('upload_status', 'verified')
        .eq('is_displayed', true),
      supabase
        .from('papers')
        .select('id, title, authors, journal, doi, impact_factor, publication_date')
        .contains('detected_products', [citationCatNo])
        .eq('upload_status', 'verified')
        .eq('is_displayed', true),
    ])
    citations = Array.from(
      new Map([
        ...(primaryCitationResult.data || []),
        ...(detectedCitationResult.data || []),
      ].map((citation) => [citation.id, citation])).values()
    ).sort((a, b) => (b.impact_factor || 0) - (a.impact_factor || 0))
  }

  let productDocuments: ProductDocumentLink[] = []
  const { data: documentRows, error: documentError } = await supabase
    .from('product_documents')
    .select('id, document_type, file_url, file_name')
    .eq('product_id', product.id)
    .eq('status', 'active')
    .order('document_type', { ascending: false })
    .order('created_at', { ascending: false })

  if (!documentError) {
    productDocuments = (documentRows || []) as ProductDocumentLink[]
  } else if (!isMissingProductDocumentsTable(documentError.message)) {
    console.error('[product-detail] product_documents load failed:', documentError.message)
  }

  const primaryDatasheetUrl =
    productDocuments.find((doc) => doc.document_type === 'datasheet')?.file_url ||
    product.datasheet_pdf ||
    null

  const downloadDocuments: ProductDocumentLink[] = [
    ...productDocuments,
    ...(product.datasheet_pdf && !productDocuments.some((doc) => doc.file_url === product.datasheet_pdf)
      ? [{
          id: 'legacy-datasheet',
          document_type: 'datasheet' as const,
          file_url: product.datasheet_pdf,
          file_name: `${displayCatNo} 说明书.pdf`,
        }]
      : []),
  ]

  // Breadcrumb items
  const breadcrumbItems = [
    { label: '首页', href: '/' },
    ...(primarySpecies
      ? [
          {
            label: primarySpeciesLabel,
            href: `/products/elisa?species=${encodeURIComponent(primarySpecies)}`,
          },
        ]
      : []),
    { label: product.target || product.name },
  ]

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Breadcrumb */}
        <div className="py-2">
          <Breadcrumb items={breadcrumbItems} />
        </div>

        {/* Main Content: Left Images + Right Order Panel */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Product Images (60%) */}
          <div className="w-full lg:w-[58%]">
            <ProductImageGallery
              images={galleryImages}
              productName={product.name}
            />
          </div>

          {/* Right: Order Panel (40%) */}
          <div className="w-full lg:w-[42%]">
            <OrderPanel
              catNo={displayCatNo}
              name={product.name}
              target={product.target || ''}
              species={displaySpecies}
              price48t={displayPrice48t}
              price96t={displayPrice96t}
              stockStatus={product.stock_status || 'out_of_stock'}
              datasheetUrl={primaryDatasheetUrl}
            />
          </div>
        </div>

        {/* Key Info Cards */}
        <section>
          <ProductInfoCards
            detectionMethod={displayDetectionMethod}
            speciesList={product.species ? [product.species] : speciesList}
            sampleTypes={displaySampleTypes}
            sensitivity={product.sensitivity}
            detectionRange={product.detection_range}
          />
        </section>

        {/* Accordion Sections */}
        <section>
          <ProductAccordion
            description={product.description}
            detectionMethod={displayDetectionMethod}
            assayTime={displayAssayTime}
            platform={displayPlatform}
            sampleTypes={displaySampleTypes}
            detectionRange={product.detection_range}
            sensitivity={product.sensitivity}
            galleryImages={galleryImages}
            citations={
              citations?.map((c) => ({
                id: c.id,
                title: c.title,
                authors: c.authors || undefined,
                journal: c.journal || undefined,
                doi: c.doi || undefined,
                impact_factor: c.impact_factor || undefined,
                publication_date: c.publication_date || undefined,
              })) || []
            }
            datasheetUrl={primaryDatasheetUrl}
            documents={downloadDocuments}
            catNo={displayCatNo}
          />
        </section>
      </div>
    </div>
  )
}
