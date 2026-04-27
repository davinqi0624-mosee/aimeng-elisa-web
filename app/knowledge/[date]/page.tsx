import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Calendar, Tag, BookOpen } from 'lucide-react'

interface Props {
  params: Promise<{ date: string }>
}

export default async function KnowledgeDetailPage({ params }: Props) {
  const { date } = await params
  const supabase = await createClient()

  const { data: item } = await supabase
    .from('daily_knowledge')
    .select('*')
    .eq('date', date)
    .maybeSingle()

  if (!item) return notFound()

  const { data: neighbors } = await supabase
    .from('daily_knowledge')
    .select('date,title')
    .order('date', { ascending: true })

  const idx = neighbors?.findIndex((n) => n.date === date) ?? -1
  const prev = idx > 0 ? neighbors![idx - 1] : null
  const next = idx >= 0 && idx < (neighbors?.length || 0) - 1 ? neighbors![idx + 1] : null

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        href="/knowledge"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        返回日历
      </Link>

      <article className="bg-white border border-gray-200 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
            <BookOpen className="w-3.5 h-3.5" />
            {item.category}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            {item.date}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">{item.title}</h1>

        <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
          {item.content}
        </div>

        {item.tags && item.tags.length > 0 && (
          <div className="mt-6 pt-6 border-t border-gray-100 flex items-center gap-2 flex-wrap">
            <Tag className="w-4 h-4 text-gray-400" />
            {item.tags.map((t: string) => (
              <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                {t}
              </span>
            ))}
          </div>
        )}
      </article>

      <div className="flex items-center justify-between mt-6">
        {prev ? (
          <Link
            href={`/knowledge/${prev.date}`}
            className="text-sm text-gray-600 hover:text-blue-600"
          >
            ← {prev.title}
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/knowledge/${next.date}`}
            className="text-sm text-gray-600 hover:text-blue-600"
          >
            {next.title} →
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  )
}
