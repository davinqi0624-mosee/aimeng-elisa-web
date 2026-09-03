'use client'

import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { ArrowLeft, Download, FileText, Loader2, Waves } from 'lucide-react'
import { buildProductDocumentDownloadUrl } from '@/lib/products/document-download'

type Product = {
  id: string
  catalog_number: string
  indicator_name: string
  specifications: string[]
  wavelength: string
  price_48t: number | string | null
  price_96t: number | string
}

type Document = { id: string; file_url: string; file_name: string; created_at: string }

export default function BiochemicalProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [document, setDocument] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [specification, setSpecification] = useState('96T')

  useEffect(() => {
    let cancelled = false
    void fetch(`/api/biochemical-products/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || '产品读取失败')
        if (cancelled) return
        setProduct(data.product)
        setDocument(data.document)
        setSpecification(data.product.specifications?.includes('96T') ? '96T' : data.product.specifications?.[0] || '96T')
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : '产品读取失败')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <main className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />正在读取产品详情</main>
  if (error || !product) return <main className="mx-auto max-w-4xl px-5 py-16"><p className="text-lg font-semibold text-slate-900">{error || '未找到该生化产品'}</p><Link href="/products/biochemical-reagents" className="mt-5 inline-flex text-sm font-semibold text-cyan-700">返回生化产品目录</Link></main>

  const currentPrice = specification === '48T' ? product.price_48t : product.price_96t
  const downloadUrl = document ? buildProductDocumentDownloadUrl(document.file_url, document.file_name) : ''

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/products/biochemical-reagents" className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-700 hover:text-cyan-900"><ArrowLeft className="h-4 w-4" />返回生化产品目录</Link>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-cyan-700">生化法试剂盒</p><h1 className="mt-2 text-3xl font-bold text-slate-950">{product.indicator_name}</h1><p className="mt-3 font-mono text-sm text-slate-500">{product.catalog_number}</p></div><Waves className="h-8 w-8 shrink-0 text-cyan-600" /></div>
            <div className="mt-8 grid gap-4 sm:grid-cols-2"><div className="border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">检测指标</p><p className="mt-1 text-base font-semibold text-slate-900">{product.indicator_name}</p></div><div className="border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">操作波长</p><p className="mt-1 text-base font-semibold text-slate-900">{product.wavelength}</p></div></div>
            <div className="mt-8 border-t border-slate-100 pt-5"><p className="text-xs text-slate-500">规格与价格</p><div className="mt-2 flex flex-wrap items-center gap-3"><select value={specification} onChange={(event) => setSpecification(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none focus:border-cyan-500">{product.specifications.map((item) => <option key={item}>{item}</option>)}</select><span className="text-xl font-bold text-emerald-700">¥{Number(currentPrice || 0).toLocaleString('zh-CN')}</span></div></div>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-cyan-700" /><div><h2 className="text-lg font-bold text-slate-950">操作说明书</h2><p className="mt-1 text-sm text-slate-500">本产品专用说明书，可在线预览或下载。</p></div></div>{document ? <><div className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-slate-100"><iframe title={`${product.indicator_name} 操作说明书`} src={document.file_url} className="h-[520px] w-full" /></div><div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="max-w-[70%] truncate text-xs text-slate-500" title={document.file_name}>{document.file_name}</p><a href={downloadUrl} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700"><Download className="h-4 w-4" />下载 PDF</a></div></> : <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-12 text-center"><FileText className="mx-auto h-8 w-8 text-slate-400" /><p className="mt-3 text-sm font-semibold text-slate-700">说明书暂未上传</p><p className="mt-1 text-xs text-slate-500">如需获取操作说明，请联系人工客服。</p></div>}</section>
        </div>
      </div>
    </main>
  )
}
