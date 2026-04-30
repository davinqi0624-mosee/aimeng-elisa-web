import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Eye,
  ThumbsUp,
  ThumbsDown,
  Star,
  Clock,
  Tag,
  MessageCircle,
  ChevronLeft,
  History,
} from 'lucide-react'
import FeedbackButtons from './FeedbackButtons'
import WeChatCopy from './WeChatCopy'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function KnowledgeArticlePage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // Increment view count
  const { data: current } = await supabase
    .from('daily_knowledge')
    .select('view_count')
    .eq('id', id)
    .single()

  if (current) {
    await supabase
      .from('daily_knowledge')
      .update({ view_count: (current.view_count || 0) + 1 })
      .eq('id', id)
  }

  const { data: article } = await supabase
    .from('daily_knowledge')
    .select('*')
    .eq('id', id)
    .single()

  if (!article) {
    notFound()
  }

  // Fetch versions
  const { data: versions } = await supabase
    .from('knowledge_versions')
    .select('*')
    .eq('knowledge_id', id)
    .order('version_number', { ascending: false })

  // Fetch related articles (same category, different id)
  const { data: related } = await supabase
    .from('daily_knowledge')
    .select('id, title, summary, category, quality_score')
    .eq('category', article.category)
    .eq('lifecycle_status', 'active')
    .neq('id', id)
    .limit(4)

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/knowledge/daily" className="text-sm text-blue-600 hover:underline">
            ← 每日知识
          </Link>
        </div>

        <article className="bg-white rounded-xl border overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                {article.category}
              </span>
              {article.is_featured && (
                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-medium flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  精选
                </span>
              )}
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(article.date).toLocaleDateString('zh-CN')}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>

            {/* Stats */}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" />
                {article.view_count} 阅读
              </span>
              <span className="flex items-center gap-1">
                <ThumbsUp className="w-4 h-4" />
                {article.helpful_count}  helpful
              </span>
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4" />
                质量分 {(article.quality_score * 100).toFixed(0)}%
              </span>
              {article.source_type === 'ai_extracted' && (
                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 rounded text-xs">
                  AI 提取
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <div className="prose prose-blue max-w-none">
              {article.content.split('\n').map((line: string, idx: number) => {
                if (line.startsWith('## ')) {
                  return <h2 key={idx} className="text-xl font-bold text-gray-900 mt-6 mb-3">{line.slice(3)}</h2>
                }
                if (line.startsWith('# ')) {
                  return <h1 key={idx} className="text-2xl font-bold text-gray-900 mt-6 mb-3">{line.slice(2)}</h1>
                }
                if (line.startsWith('- ') || line.startsWith('* ')) {
                  return <li key={idx} className="ml-4 text-gray-700">{line.slice(2)}</li>
                }
                if (line.startsWith('|')) {
                  // Skip table separator lines
                  if (line.includes('---')) return null
                  const cells = line.split('|').filter(Boolean).map(c => c.trim())
                  return (
                    <div key={idx} className="grid grid-cols-3 gap-2 my-1 text-sm">
                      {cells.map((cell, cidx) => (
                        <div key={cidx} className={`px-2 py-1 ${cidx === 0 ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                          {cell}
                        </div>
                      ))}
                    </div>
                  )
                }
                if (line.trim() === '') {
                  return <div key={idx} className="h-2" />
                }
                return <p key={idx} className="text-gray-700 leading-relaxed">{line}</p>
              })}
            </div>
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4 text-gray-400" />
                {article.tags.map((tag: string) => (
                  <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Feedback */}
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">这篇文章帮到你了吗？</p>
                <p className="text-xs text-gray-400 mt-0.5">你的反馈帮助我们持续改进知识库</p>
              </div>
              <div className="flex items-center gap-3">
                <WeChatCopy
                  title={article.title}
                  summary={article.summary}
                  content={article.content}
                  category={article.category}
                  date={article.date}
                  tags={article.tags || []}
                />
                <FeedbackButtons knowledgeId={article.id} />
              </div>
            </div>
          </div>
        </article>

        {/* Versions */}
        {versions && versions.length > 0 && (
          <div className="mt-6 bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <History className="w-4 h-4" />
              历史版本
            </h3>
            <div className="space-y-2">
              {versions.map((v: any) => (
                <div key={v.id} className="flex items-center justify-between text-sm py-2 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">
                      v{v.version_number}
                    </span>
                    <span className="text-gray-600">{v.change_summary || '内容更新'}</span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(v.created_at).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related articles */}
        {related && related.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">相关推荐</h3>
            <div className="space-y-2">
              {related.map((r: any) => (
                <Link
                  key={r.id}
                  href={`/knowledge/article/${r.id}`}
                  className="block bg-white rounded-xl border p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">{r.title}</h4>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.summary}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0 ml-3">
                      <Star className="w-3 h-3" />
                      {(r.quality_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* AI Chat entry */}
        <div className="mt-6 bg-blue-50 rounded-xl p-5 border border-blue-100">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900">还有疑问？</p>
              <p className="text-xs text-blue-600">AI 客服可以帮你解答更多实验问题</p>
            </div>
            <Link
              href="/chat"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
            >
              问 AI 客服
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
