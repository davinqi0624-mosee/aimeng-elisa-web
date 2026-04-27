import Link from 'next/link'
import { CalendarDays, Archive, Home } from 'lucide-react'

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-blue-600 font-bold text-lg">
            <Home className="w-5 h-5" />
            <span>艾萌 ELISA</span>
          </Link>
          <div className="flex-1" />
          <Link
            href="/knowledge"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            <CalendarDays className="w-4 h-4" />
            每日知识
          </Link>
          <Link
            href="/knowledge/archive"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            <Archive className="w-4 h-4" />
            历史归档
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
