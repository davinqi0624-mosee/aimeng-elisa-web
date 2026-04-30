import Link from 'next/link'
import { FlaskConical, ClipboardList, BarChart3, Home } from 'lucide-react'

export default function LabLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-full bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold text-lg">
            <Home className="w-5 h-5" />
            <span>爱萌优宁</span>
          </Link>
          <div className="flex-1" />
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
