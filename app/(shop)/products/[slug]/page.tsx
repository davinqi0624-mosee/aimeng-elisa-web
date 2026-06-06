import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Breadcrumb from '@/components/ui/Breadcrumb'
import OrderPanel from '@/components/product/OrderPanel'
import ProductInfoCards from '@/components/product/ProductInfoCards'
import ProductAccordion from '@/components/product/ProductAccordion'
import ProductImageGallery from '@/components/product/ProductImageGallery'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch product with all related data (defensive: try new columns, fall back if missing)
  let productQuery = supabase
    .from('products')
    .select(
      '*, product_species(species, species_name_zh, is_primary), product_aliases(alias, alias_type), product_images(image_url, image_type, display_order), cat_no, citation_count, product_image, standard_curve_image, validation_image, additional_image, datasheet_pdf, price_48t, price_96t, species, catalog_number'
    )
    .eq('slug', slug)
    .eq('status', 'active')

  let { data: product, error: productError } = await productQuery.single()

  // If new columns don't exist yet, fall back to base query
  if (productError && (productError.message?.includes('price_48t') || productError.message?.includes('price_96t') || productError.message?.includes('species'))) {
    const { data: fallbackProduct, error: fallbackError } = await supabase
      .from('products')
      .select(
        '*, product_species(species, species_name_zh, is_primary), product_aliases(alias, alias_type), product_images(image_url, image_type, display_order), cat_no, citation_count, product_image, standard_curve_image, validation_image, additional_image, datasheet_pdf, prices, catalog_number'
      )
      .eq('slug', slug)
      .eq('status', 'active')
      .single()

    if (fallbackError || !fallbackProduct) {
      notFound()
    }

    product = fallbackProduct as any
  }

  if (!product) {
    notFound()
  }

  const speciesRows = (product.product_species || []) as any[]
  const aliasRows = (product.product_aliases || []) as any[]

  const speciesList = speciesRows.map((s) => s.species) as string[]
  const aliasList = aliasRows.map((a) => a.alias) as string[]

  // Primary species for breadcrumb
  const primarySpeciesRow = speciesRows.find((s) => s.is_primary)
  const primarySpecies = primarySpeciesRow?.species || speciesList[0]
  const primarySpeciesLabel = primarySpeciesRow?.species_name_zh || primarySpecies

  // Fallback values when new columns don't exist yet
  const displaySpecies = product.species || primarySpecies || undefined
  const displayPrice48t = product.price_48t ?? product.prices?.['48T'] ?? undefined
  const displayPrice96t = product.price_96t ?? product.prices?.['96T'] ?? undefined

  // Fetch citations
  const { data: citations } = await supabase
    .from('papers')
    .select('id, title, authors, journal, doi, impact_factor, publication_date')
    .eq('product_cat_no', product.cat_no)
    .eq('upload_status', 'verified')
    .eq('is_displayed', true)
    .order('impact_factor', { ascending: false })

  // Breadcrumb items
  const breadcrumbItems = [
    { label: '首页', href: '/' },
    ...(primarySpecies
      ? [
          {
            label: primarySpeciesLabel,
            href: `/products?species=${encodeURIComponent(primarySpecies)}`,
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
              images={[
                ...(product.product_image ? [{ url: product.product_image, label: '产品照片', type: 'product' }] : []),
                ...(product.standard_curve_image ? [{ url: product.standard_curve_image, label: '标准曲线', type: 'standard_curve' }] : []),
                ...(product.validation_image ? [{ url: product.validation_image, label: '验证数据', type: 'validation' }] : []),
                ...(product.additional_image ? [{ url: product.additional_image, label: '其他图片', type: 'additional' }] : []),
              ]}
              productName={product.name}
            />
          </div>

          {/* Right: Order Panel (40%) */}
          <div className="w-full lg:w-[42%]">
            <OrderPanel
              catNo={product.catalog_number || product.cat_no || '-'}
              name={product.name}
              target={product.target || ''}
              species={displaySpecies}
              price48t={displayPrice48t}
              price96t={displayPrice96t}
              stockStatus={product.stock_status || 'out_of_stock'}
              datasheetUrl={product.datasheet_pdf}
            />
          </div>
        </div>

        {/* Key Info Cards */}
        <section>
          <ProductInfoCards
            detectionMethod={product.detection_method}
            speciesList={product.species ? [product.species] : speciesList}
            sensitivity={product.sensitivity}
            detectionRange={product.detection_range}
          />
        </section>

        {/* Accordion Sections */}
        <section>
          <ProductAccordion
            description={product.description}
            detectionRange={product.detection_range}
            sensitivity={product.sensitivity}
            galleryImages={[
              ...(product.product_image ? [{ url: product.product_image, type: 'product', label: '产品照片' }] : []),
              ...(product.standard_curve_image ? [{ url: product.standard_curve_image, type: 'standard_curve', label: '标准曲线' }] : []),
              ...(product.validation_image ? [{ url: product.validation_image, type: 'validation', label: '验证数据' }] : []),
              ...(product.additional_image ? [{ url: product.additional_image, type: 'additional', label: '其他图片' }] : []),
            ]}
            citations={
              citations?.map((c) => ({
                id: c.id,
                title: c.title,
                authors: c.authors,
                journal: c.journal,
                doi: c.doi,
                impact_factor: c.impact_factor,
                publication_date: c.publication_date,
              })) || []
            }
            datasheetUrl={product.datasheet_pdf}
            catNo={product.catalog_number || product.cat_no || '-'}
          />
        </section>
      </div>
    </div>
  )
}
