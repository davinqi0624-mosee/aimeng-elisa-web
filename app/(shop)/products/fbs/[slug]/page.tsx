import { notFound } from 'next/navigation'
import SerumProductDetail from '@/components/product/SerumProductDetail'
import { getPublishedSerumProduct } from '@/lib/products/serum-products-db'

export default async function FbsProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getPublishedSerumProduct(slug)

  if (!product || product.category !== 'fbs') {
    notFound()
  }

  return (
    <SerumProductDetail
      product={product}
      backHref="/products/fbs"
      backLabel="返回胎牛血清"
    />
  )
}
