import { ShieldCheck } from 'lucide-react'
import CoaLookupForm from './CoaLookupForm'

export default async function CoaQueryPage({
  searchParams,
}: {
  searchParams: Promise<{ catalog?: string }>
}) {
  const { catalog } = await searchParams

  return (
    <div className="min-h-full bg-[#F2F6FA]">
      <div className="max-w-7xl mx-auto px-4 py-12 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
            coa.lookup / batch trace
          </p>
          <h1 className="mt-4 text-3xl font-black tracking-normal text-slate-950">血清 COA 查询</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            输入血清货号和批号，即可查看并下载对应批次的质检报告文件。
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <CoaLookupForm initialCatalog={catalog?.trim() || ''} />

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-teal-700" />
              使用说明
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>1. COA 仅针对血清批次，不与 ELISA 说明书合并。</p>
              <p>2. 同一货号不同批次的 COA 可能不同，下载前请确认批号。</p>
              <p>3. 若查询不到对应批次，请联系技术支持补发文件。</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
