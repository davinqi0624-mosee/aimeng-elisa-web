import SerumShowcase from '@/components/product/SerumShowcase'
import { getPublishedSerumProductsByCategory } from '@/lib/products/serum-products-db'

export default async function AnimalSerumProductsPage() {
  const products = await getPublishedSerumProductsByCategory('animal-serum')

  return (
    <SerumShowcase
      category="animal-serum"
      title="动物血制品"
      subtitle="其他动物血清和血制品以橱窗形式展示，适合客户快速判断用途、规格和检测参数，再进入详情页确认实验适配性。"
      products={products}
    />
  )
}
