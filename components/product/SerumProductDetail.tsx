import Link from 'next/link'
import { ArrowLeft, BarChart3, CheckCircle2, FileSearch, FlaskConical, Package } from 'lucide-react'
import type { SerumProduct } from '@/lib/products/serum-products'
import SerumImage from '@/components/product/SerumImage'

interface SerumProductDetailProps {
  product: SerumProduct
  backHref: string
  backLabel: string
}

export default function SerumProductDetail({ product, backHref, backLabel }: SerumProductDetailProps) {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Link href={backHref} className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        <section className="grid items-start gap-6 md:grid-cols-[320px_1fr] lg:grid-cols-[360px_1fr]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <SerumImage
              src={product.imageUrl}
              alt={product.name}
              className="mx-auto h-[260px] w-full sm:h-[300px]"
              imageClassName="max-h-[220px] max-w-[78%] sm:max-h-[250px]"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{product.englishName}</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">{product.name}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{product.summary}</p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">货号</p>
                <p className="mt-1 font-bold text-slate-900">{product.catalogNumber}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">包装规格</p>
                <p className="mt-1 font-bold text-slate-900">{product.packageSize}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">血源地</p>
                <p className="mt-1 font-bold text-slate-900">{product.origin}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">产品类型</p>
                <p className="mt-1 font-bold text-slate-900">{product.serumType}</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/products/coa"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                <FileSearch className="h-4 w-4" />
                查询批次 COA
              </Link>
              <Link
                href="/contact"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Package className="h-4 w-4" />
                咨询库存/价格
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1fr_0.92fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FlaskConical className="h-4 w-4 text-emerald-600" />
              产品介绍
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              {product.description.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              应用分类
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {product.applications.map((item) => (
                <span key={item} className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
            适用细胞/应用范围
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
              {product.cellApplications.map((item) => (
                <span key={item} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {item}
                </span>
              ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-amber-600" />
            检测项目及参数要求
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <div className="grid grid-cols-[1fr_1.2fr] bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
              <span>检测项目</span>
              <span>参数要求</span>
            </div>
            {product.qualityItems.map((item) => (
              <div key={item.label} className="grid grid-cols-[1fr_1.2fr] border-t border-slate-100 px-4 py-3 text-sm">
                <span className="font-medium text-slate-700">{item.label}</span>
                <span className="text-slate-600">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        {product.comparisonPoints && product.comparisonPoints.length > 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <BarChart3 className="h-4 w-4 text-emerald-600" />
              与常规血清测试/服务对比
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
              <div className="grid grid-cols-[0.8fr_1fr_1fr] bg-slate-50 px-4 py-3 text-xs font-bold text-slate-500">
                <span>项目</span>
                <span>爱萌优宁</span>
                <span>常规方式</span>
              </div>
              {product.comparisonPoints.map((item) => (
                <div key={item.label} className="grid grid-cols-[0.8fr_1fr_1fr] border-t border-slate-100 px-4 py-3 text-sm">
                  <span className="font-medium text-slate-700">{item.label}</span>
                  <span className="text-emerald-700">{item.aimeng}</span>
                  <span className="text-slate-500">{item.common}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
