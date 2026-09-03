import Link from 'next/link'
import { ArrowRight, FileSearch, Package, ShieldCheck } from 'lucide-react'
import type { SerumCategory, SerumProduct, SerumShowcaseGroup } from '@/lib/products/serum-products'
import SerumImage from '@/components/product/SerumImage'

interface SerumShowcaseProps {
  category: SerumCategory
  title: string
  subtitle: string
  products: SerumProduct[]
  groups?: SerumShowcaseGroup[]
}

function ProductTile({
  product,
  basePath,
}: {
  product: SerumProduct
  basePath: string
}) {
  return (
    <Link
      href={`${basePath}/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <SerumImage
        src={product.imageUrl}
        alt={product.name}
        compact
        className="h-[260px] shrink-0 border-b border-slate-100"
        imageClassName="max-h-[210px] max-w-[72%] transition-transform duration-300 group-hover:scale-105"
      />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{product.name}</h2>
            <p className="mt-1 text-xs font-medium text-slate-500">{product.englishName}</p>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
        </div>
        <p className="mt-3 min-h-[40px] text-sm leading-5 text-slate-600">{product.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {product.applications.slice(0, 3).map((item) => (
            <span key={item} className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              {item}
            </span>
          ))}
        </div>
        <div className="mt-auto grid gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Package className="h-3.5 w-3.5 text-amber-600" />
            {product.packageSize}
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            {product.catalogNumber}
          </div>
        </div>
      </div>
    </Link>
  )
}

export default function SerumShowcase({ category, title, subtitle, products, groups }: SerumShowcaseProps) {
  const basePath = category === 'fbs' ? '/products/fbs' : '/products/animal-serum'

  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                批次 COA 可追溯
              </div>
              <h1 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">客户查找路径</p>
              <div className="mt-3 grid gap-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-emerald-700">1</span>
                  选择产品类型和规格
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-emerald-700">2</span>
                  进入产品内页查看参数和适用场景
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-emerald-700">3</span>
                  收货后按批号查询 COA
                </div>
              </div>
              <Link
                href="/products/coa"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <FileSearch className="h-4 w-4" />
                COA 查询
              </Link>
            </div>
          </div>
        </section>

        {groups && groups.length > 0 ? (
          <section className="space-y-6">
            {groups.map((group, index) => (
              <div
                key={group.title}
                className={`overflow-hidden rounded-lg border border-slate-200 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-800 text-white'
                }`}
              >
                <div className="grid gap-0 lg:grid-cols-[260px_1fr]">
                  <div className={`flex flex-col justify-center p-6 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-slate-700'}`}>
                    <p className={`text-xs font-semibold ${index % 2 === 0 ? 'text-emerald-700' : 'text-emerald-200'}`}>{group.code}</p>
                    <h2 className="mt-2 text-xl font-bold">{group.title}</h2>
                    <p className={`mt-3 text-sm leading-6 ${index % 2 === 0 ? 'text-slate-600' : 'text-slate-200'}`}>{group.description}</p>
                    <div className="mt-4 grid gap-1.5">
                      {group.applications.map((item) => (
                        <span key={item} className={`text-sm ${index % 2 === 0 ? 'text-slate-700' : 'text-slate-100'}`}>
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                    {group.products.map((product) => (
                      <ProductTile key={product.slug} product={product} basePath={basePath} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : (
          <section className="grid items-stretch gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductTile key={product.slug} product={product} basePath={basePath} />
            ))}
          </section>
        )}
      </div>
    </div>
  )
}
