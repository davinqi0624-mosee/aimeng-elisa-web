import Link from 'next/link'
import { ClipboardList, BarChart3, Calculator } from 'lucide-react'

export default function LabLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full bg-gray-50">
      <nav className="sticky top-0 z-20 border-b border-yellow-100 bg-yellow-50/75 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <div className="flex-1" />
          <Link
            href="/lab/calculator"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            <Calculator className="w-4 h-4" />
            酶标板计算器
          </Link>
          <Link
            href="/lab/experiment"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            <ClipboardList className="w-4 h-4" />
            方案生成
          </Link>
          <Link
            href="/lab/analysis"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600"
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
