import Link from 'next/link'
import { ClipboardList, BarChart3, Calculator } from 'lucide-react'

export default function LabLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full bg-[#F2F6FA]">
      <nav className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <p className="flex-1 font-mono text-xs font-semibold uppercase tracking-[0.28em] text-[#177E97]">
            lab.tools / experiment suite
          </p>
          <Link
            href="/lab/calculator"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#177E97]"
          >
            <Calculator className="w-4 h-4" />
            酶标板计算器
          </Link>
          <Link
            href="/lab/experiment"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#177E97]"
          >
            <ClipboardList className="w-4 h-4" />
            方案生成
          </Link>
          <Link
            href="/lab/analysis"
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#177E97]"
          >
            <BarChart3 className="w-4 h-4" />
            数据分析
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
