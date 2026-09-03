import SerumShowcase from '@/components/product/SerumShowcase'
import { fbsShowcaseGroups } from '@/lib/products/serum-products'
import { getPublishedSerumProductsByCategoryWithSource } from '@/lib/products/serum-products-db'

export default async function FbsProductsPage() {
  const { products, source } = await getPublishedSerumProductsByCategoryWithSource('fbs')

  return (
    <SerumShowcase
      category="fbs"
      title="胎牛血清"
      subtitle="胎牛血清按常规培养、批次优选和特殊筛选/特殊工艺分流。常规应用重点看细胞测试数据，特殊血清重点看工艺原理和参数。"
      products={products}
      groups={source === 'fallback' ? fbsShowcaseGroups : undefined}
    />
  )
}
