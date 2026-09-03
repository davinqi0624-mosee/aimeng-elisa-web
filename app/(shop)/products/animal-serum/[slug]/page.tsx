import { notFound } from 'next/navigation'
import SerumProductDetail from '@/components/product/SerumProductDetail'
import { getPublishedSerumProduct } from '@/lib/products/serum-products-db'

export default async function AnimalSerumProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getPublishedSerumProduct(slug)

  if (!product || product.category !== 'animal-serum') {
    notFound()
  }

  return (
    <SerumProductDetail
      product={product}
      backHref="/products/animal-serum"
      backLabel="返回动物血制品"
    />
  )
}
