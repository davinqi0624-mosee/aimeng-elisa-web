'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search, Waves } from 'lucide-react'
import OfficialCustomerServiceButton from '@/components/product/OfficialCustomerServiceButton'

type BiochemicalProduct = {
  id: string
  catalog_number: string
  indicator_name: string
  specifications: string[]
  wavelength: string
  price_48t: number | string | null
  price_96t: number | string
}

export default function BiochemicalProductSearch() {
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<BiochemicalProduct[]>([])
  const [selectedSpecifications, setSelectedSpecifications] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [needsMigration, setNeedsMigration] = useState(false)

  const loadProducts = useCallback(async (search = '') => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      const response = await fetch(`/api/biochemical-products?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '产品目录读取失败')
      setProducts(data.products || [])
      setNeedsMigration(Boolean(data.needsMigration))
      setSelectedSpecifications((current) => {
        const next = { ...current }
        for (const product of data.products || []) {
          if (!next[product.id]) next[product.id] = product.specifications?.includes('96T') ? '96T' : product.specifications?.[0] || '96T'
        }
        return next
      })
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '产品目录读取失败')
      setProducts([])
      setNeedsMigration(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadProducts(), 0)
    return () => window.clearTimeout(timer)
  }, [loadProducts])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextQuery = draftQuery.trim()
    setQuery(nextQuery)
    void loadProducts(nextQuery)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-bold text-slate-950">
              <Search className="h-5 w-5 text-cyan-700" />
              生化法试剂盒检索
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              按货号或指标名称查找生化法试剂盒。产品可能提供 96T 或 48T / 96T 双规格，价格和操作波长以产品目录为准。
            </p>
          </div>
          <OfficialCustomerServiceButton
            label="转人工客服"
            variant="outline"
            note="请备注生化检测指标、样本类型、仪器条件和实验用途，客服会协助确认产品和价格。"
            className="shrink-0"
          />
        </div>
      </div>

      <div className="px-5 py-5">
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="relative block">
            <span className="sr-only">搜索生化产品</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="输入货号或指标名称，例如 SOD、MDA、LV90001"
              className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white"
            />
          </label>
          <button type="submit" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-cyan-700">
            <Search className="h-4 w-4" />
            搜索
          </button>
        </form>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-cyan-50 px-4 py-3">
            <p className="text-xs font-semibold text-cyan-700">产品规格</p>
            <p className="mt-1 text-sm font-bold text-slate-900">96T 或 48T / 96T</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-4 py-3">
            <p className="text-xs font-semibold text-emerald-700">核心字段</p>
            <p className="mt-1 text-sm font-bold text-slate-900">货号 · 指标 · 波长</p>
          </div>
          <div className="rounded-lg bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700">价格显示</p>
            <p className="mt-1 text-sm font-bold text-slate-900">按所选规格显示</p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 px-5 py-5">
        {needsMigration && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
            产品目录正在使用兼容读取模式，后台完成数据库升级后即可支持 48T / 96T 双规格价格。
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取生化产品目录
          </div>
        ) : error ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">{error}</div>
        ) : products.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {products.map((product) => (
              <article key={product.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-cyan-200 hover:bg-cyan-50/40">
                {(() => {
                  const selectedSpecification = selectedSpecifications[product.id] || '96T'
                  const currentPrice = selectedSpecification === '48T' ? product.price_48t : product.price_96t
                  return (
                    <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">生化法试剂盒</p>
                    <Link href={`/products/biochemical-reagents/${product.id}`} className="mt-1 block text-lg font-bold text-slate-950 hover:text-cyan-700">
                      {product.indicator_name}
                    </Link>
                  </div>
                  <Waves className="h-5 w-5 shrink-0 text-cyan-600" />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div><dt className="text-xs text-slate-500">货号</dt><dd className="mt-0.5 font-semibold text-slate-900">{product.catalog_number}</dd></div>
                  <div><dt className="text-xs text-slate-500">检测波长</dt><dd className="mt-0.5 font-semibold text-slate-900">{product.wavelength}</dd></div>
                  <div><dt className="text-xs text-slate-500">规格与价格</dt><dd className="mt-0.5 flex items-center gap-2"><select value={selectedSpecification} onChange={(event) => setSelectedSpecifications((current) => ({ ...current, [product.id]: event.target.value }))} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-cyan-500">{(product.specifications?.length ? product.specifications : ['96T']).map((specification) => <option key={specification} value={specification}>{specification}</option>)}</select><span className="font-semibold text-emerald-700">¥{Number(currentPrice || 0).toLocaleString('zh-CN')}</span></dd></div>
                </dl>
                <Link href={`/products/biochemical-reagents/${product.id}`} className="mt-4 inline-flex items-center text-sm font-semibold text-cyan-700 hover:text-cyan-900">
                  查看产品详情与操作说明书 <span aria-hidden="true" className="ml-1">→</span>
                </Link>
                    </>
                  )
                })()}
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm font-bold text-slate-900">{query ? '暂未找到匹配的生化法试剂盒' : '生化法试剂盒目录正在整理中'}</p>
            <p className="mt-1 text-sm leading-6 text-slate-500">如需确认某个指标，请联系人工客服提供指标名称、样本类型和检测仪器信息。</p>
          </div>
        )}
      </div>
    </section>
  )
}
