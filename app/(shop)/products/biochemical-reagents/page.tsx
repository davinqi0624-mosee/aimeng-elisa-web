import Link from 'next/link'
import { FileText, FlaskConical, Microscope, ShieldCheck, TestTube2 } from 'lucide-react'
import BiochemicalProductSearch from './BiochemicalProductSearch'
import OfficialCustomerServiceButton from '@/components/product/OfficialCustomerServiceButton'

const reagentGroups = [
  {
    title: '蛋白免疫印迹 WB 试剂',
    description: '适用于 Western blot 实验中的蛋白转膜、封闭、抗体孵育和显色发光相关试剂需求。',
    examples: ['转膜缓冲液', '封闭液', 'ECL 发光液'],
    icon: <FlaskConical className="h-5 w-5" />,
  },
  {
    title: '免疫组化 IHC 试剂',
    description: '适用于组织切片染色、抗原修复、封闭、显色和复染等免疫组化实验流程。',
    examples: ['抗原修复液', 'DAB 显色液', '封闭血清'],
    icon: <TestTube2 className="h-5 w-5" />,
  },
  {
    title: '生化检测',
    description: '适用于血清、血浆、组织匀浆和细胞上清等样本中的常规生化指标检测。',
    examples: ['MDA / GSH', 'SOD / CAT', '总蛋白 / 白蛋白'],
    icon: <Microscope className="h-5 w-5" />,
  },
]

const workflow = [
  '确认检测指标、样本类型和样本数量。',
  '根据实验场景确认检测方法、波长、样本前处理和仪器条件。',
  '由人工客服确认现货、规格、价格和是否需要代测服务。',
]

export default function BiochemicalReagentsPage() {
  return (
    <div className="min-h-full bg-[#F2F6FA]">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-10">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
              aimeng.products / biochemical reagents
            </p>
            <h1 className="mt-4 text-2xl font-black tracking-normal text-slate-950 md:text-3xl">生化法试剂盒</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              生化法试剂盒与 ELISA 试剂盒采用不同的产品信息结构，独立展示货号、指标名称、规格、操作波长和对应价格，方便按实验指标快速查找。
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <OfficialCustomerServiceButton
                label="咨询人工客服"
                note="请备注 WB / IHC / 生化检测方向、检测指标、样本类型和实验用途。"
              />
              <Link
                href="/products/elisa"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              >
                返回 ELISA 产品检索
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-blue-100 bg-blue-50 shadow-sm">
            <div className="grid grid-cols-3 border-b border-blue-100 bg-white/70">
              {['样本', '方法', '结果'].map((item, index) => (
                <div key={item} className="border-r border-blue-100 p-4 last:border-r-0">
                  <div className="text-xs font-semibold text-cyan-700">0{index + 1}</div>
                  <div className="mt-1 text-sm font-bold text-[#123A63]">{item}</div>
                </div>
              ))}
            </div>
            <div className="p-5">
              <p className="text-sm font-semibold text-slate-950">适合需要先确认检测方法的客户咨询</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                这类产品通常需要确认检测指标、样本类型、检测波长、前处理方式和仪器条件。产品目录由后台逐个维护，发布后会自动出现在上方检索窗口。
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <BiochemicalProductSearch />

        <section className="grid gap-5 md:grid-cols-3">
          {reagentGroups.map((group) => (
            <div key={group.title} className="rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                {group.icon}
              </div>
              <h2 className="mt-4 text-lg font-bold text-slate-950">{group.title}</h2>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-600">{group.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {group.examples.map((example) => (
                  <span key={example} className="rounded-md bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {example}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              选型前建议提供
            </div>
            <div className="mt-4 grid gap-3 text-sm leading-6 text-slate-600">
              <p>检测指标名称或英文缩写</p>
              <p>样本类型：血清、血浆、组织匀浆、细胞上清或其他样本</p>
              <p>样本数量、预期检测范围和是否需要代测</p>
              <p>实验方法和仪器条件，例如 WB、IHC、酶标仪波长或比色检测平台</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
              <FileText className="h-4 w-4 text-blue-600" />
              当前上线流程
            </div>
            <div className="mt-4 grid gap-3">
              {workflow.map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-cyan-700">
                    {index + 1}
                  </span>
                  <span className="leading-6">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
