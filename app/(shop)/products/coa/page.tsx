import { FileSearch, FileText, ShieldCheck } from 'lucide-react'
import CoaLookupForm from './CoaLookupForm'

export default function CoaQueryPage() {
  return (
    <div className="min-h-full bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 md:p-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <FileSearch className="h-3.5 w-3.5" />
            COA 查询
          </div>
          <h1 className="mt-4 text-2xl font-bold text-slate-900 md:text-3xl">血清 COA 查询</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            这里只保留血清批次查询。COA 会随着批号变化而更新，客户输入货号和批号后即可查看对应质检文件。
          </p>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <CoaLookupForm />

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              使用说明
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>1. COA 仅针对血清批次，不与 ELISA 说明书合并。</p>
              <p>2. 同一货号不同批次的 COA 可能不同，下载前请确认批号。</p>
              <p>3. 后台导入时文件名建议包含货号和批号，避免错配。</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-dashed border-slate-300 bg-white p-5">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 text-slate-400" />
            <div>
              <p className="text-sm font-bold text-slate-900">后台维护建议</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                COA 文件建议按“血清货号 + 批号”录入数据库，文件名也保留货号和批号，避免不同批次错配。
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
