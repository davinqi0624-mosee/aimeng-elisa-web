import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Breadcrumb from '@/components/ui/Breadcrumb'
import ProductImageGallery from '@/components/product/ProductImageGallery'
import OrderPanel from '@/components/product/OrderPanel'
import ProductInfoCards from '@/components/product/ProductInfoCards'
import ProductAccordion from '@/components/product/ProductAccordion'

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch product with all related data
  const { data: product } = await supabase
    .from('products')
    .select(
      '*, product_species(species, species_name_zh, is_primary), product_aliases(alias, alias_type), product_images(image_url, image_type, display_order), cat_no, citation_count'
    )
    .eq('slug', slug)
    .eq('status', 'active')
    .single()

  if (!product) {
    notFound()
  }

  const speciesRows = (product.product_species || []) as any[]
  const aliasRows = (product.product_aliases || []) as any[]
  const imageRows = (product.product_images || []) as any[]

  const speciesList = speciesRows.map((s) => s.species) as string[]
  const aliasList = aliasRows.map((a) => a.alias) as string[]

  // Primary species for breadcrumb
  const primarySpeciesRow = speciesRows.find((s) => s.is_primary)
  const primarySpecies = primarySpeciesRow?.species || speciesList[0]
  const primarySpeciesLabel = primarySpeciesRow?.species_name_zh || primarySpecies

  // Build gallery images
  const galleryImages = imageRows
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
    .map((img) => ({
      url: img.image_url,
      type: img.image_type,
      label: img.image_type,
    }))

  // Fallback if no product_images
  if (galleryImages.length === 0) {
    const fallbackImage = product.image_url || '/images/elisa/elisa_sandwich_lego.jpg'
    galleryImages.push({
      url: fallbackImage,
      type: 'principle',
      label: '检测原理',
    })
  }

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

        {/* Main Content: Left Image + Right Order Panel */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Image Gallery (60%) */}
          <div className="w-full lg:w-[58%]">
            <ProductImageGallery
              images={galleryImages}
              productName={product.name}
            />
          </div>

          {/* Right: Order Panel (40%) */}
          <div className="w-full lg:w-[42%]">
            <OrderPanel
              catNo={product.cat_no || '-'}
              name={product.name}
              target={product.target || ''}
              basePrice={product.price || 0}
              stockStatus={product.stock_status || 'out_of_stock'}
              datasheetUrl={product.datasheet_url}
            />
          </div>
        </div>

        {/* Key Info Cards */}
        <section>
          <ProductInfoCards
            detectionMethod={product.detection_method}
            speciesList={speciesList}
            sampleType={product.sample_type || []}
            sensitivity={product.sensitivity}
            detectionRange={product.detection_range}
            assayTime={product.assay_time}
          />
        </section>

        {/* Accordion Sections */}
        <section>
          <ProductAccordion
            description={product.description}
            detectionRange={product.detection_range}
            sensitivity={product.sensitivity}
            sampleType={product.sample_type || []}
            galleryImages={galleryImages}
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
            datasheetUrl={product.datasheet_url}
            catNo={product.cat_no || '-'}
          />
        </section>
      </div>
    </div>
  )
}
