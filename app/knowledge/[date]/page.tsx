import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Tag, BookOpen } from 'lucide-react';
import WeChatCopyButton from '../../../components/WeChatCopyButton';

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  publish_date: string;
  summary: string | null;
  created_at: string;
}

async function getArticle(date: string): Promise<KnowledgeArticle | null> {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Try daily_knowledge first (has most articles), fallback to knowledge_base
  const { data: dailyData } = await supabase
    .from('daily_knowledge')
    .select('*')
    .eq('date', date)
    .single();

  if (dailyData) {
    return { ...dailyData, publish_date: dailyData.date } as KnowledgeArticle;
  }

  const { data, error } = await supabase
    .from('knowledge_base')
    .select('*')
    .eq('publish_date', date)
    .single();

  if (error || !data) return null;
  return data as KnowledgeArticle;
}

async function getAdjacentArticles(date: string) {
  const { createClient } = await import('@supabase/supabase-js');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Union of dates from both tables
  const { data: dailyDates } = await supabase
    .from('daily_knowledge')
    .select('date, title')
    .order('date', { ascending: true });

  const { data: baseDates } = await supabase
    .from('knowledge_base')
    .select('publish_date, title')
    .eq('is_published', true)
    .order('publish_date', { ascending: true });

  const allDates = new Map<string, { date: string; title: string }>();
  (baseDates || []).forEach((d) => {
    allDates.set(d.publish_date, { date: d.publish_date, title: d.title });
  });
  (dailyDates || []).forEach((d) => {
    allDates.set(d.date, { date: d.date, title: d.title });
  });

  const sorted = Array.from(allDates.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const idx = sorted.findIndex((d) => d.date === date);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

  return { prev, next };
}

function renderMarkdown(content: string) {
  let html = content
    .replace(/^##\s+(.+)$/gm, '<h2 class="text-xl font-bold text-slate-800 mt-8 mb-4">$1</h2>')
    .replace(/^###\s+(.+)$/gm, '<h3 class="text-lg font-semibold text-slate-700 mt-6 mb-3">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^-\s+(.+)$/gm, '<li class="ml-4 text-slate-600 leading-relaxed">$1</li>')
    .replace(/^(\d+)\.\s+(.+)$/gm, '<li class="ml-4 text-slate-600 leading-relaxed"><span class="font-medium">$1.</span> $2</li>')
    .replace(/\n{2,}/g, '</p><p class="text-slate-600 leading-relaxed mb-4">')
    .replace(/^(.+)$/gm, (match) => {
      if (match.startsWith('<')) return match;
      return `<p class="text-slate-600 leading-relaxed mb-4">${match}</p>`;
    });

  html = html.replace(/<\/p><p[^>]*>(<h[23][^>]*>)/g, '$1');
  html = html.replace(/(<\/h[23]>)<\/p>/g, '$1');
  html = html.replace(/<p[^>]*><\/p>/g, '');

  return html;
}

export default async function KnowledgeArticlePage({
  params,
}: {
  params: Promise<{ date: string }> | { date: string };
}) {
  const resolvedParams = await params;
  const date = resolvedParams.date;

  const [article, { prev, next }] = await Promise.all([
    getArticle(date),
    getAdjacentArticles(date),
  ]);

  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link
            href="/knowledge"
            className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回日历</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/knowledge" className="text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              每日知识
            </Link>
            <Link href="/knowledge/archive" className="text-sm text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1">
              <BookOpen className="w-4 h-4" />
              历史归档
            </Link>
          </div>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
              {article.category}
            </span>
            <span className="text-sm text-slate-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {article.publish_date}
            </span>
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-4">
            {article.title}
          </h1>

          {article.summary && (
            <p className="text-slate-500 text-base leading-relaxed border-l-4 border-blue-200 pl-4 bg-blue-50/50 py-2 rounded-r-lg">
              {article.summary}
            </p>
          )}

          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {article.tags.map((tag: string) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-slate-500 bg-slate-100">
                  <Tag className="w-3 h-3" />
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-slate-200">
          <WeChatCopyButton
            title={article.title}
            content={article.content}
            category={article.category}
            publishDate={article.publish_date}
            summary={article.summary || ''}
          />
          <span className="text-xs text-slate-400">
            点击复制，直接粘贴到微信公众号编辑器
          </span>
        </div>

        <div
          className="prose prose-slate max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
        />

        <nav className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 gap-4">
          {prev ? (
            <Link href={`/knowledge/${prev.date}`} className="group p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all">
              <span className="text-xs text-slate-400 mb-1 block">← 上一篇</span>
              <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 line-clamp-2">{prev.title}</span>
            </Link>
          ) : <div />}
          {next ? (
            <Link href={`/knowledge/${next.date}`} className="group p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all text-right">
              <span className="text-xs text-slate-400 mb-1 block">下一篇 →</span>
              <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 line-clamp-2">{next.title}</span>
            </Link>
          ) : <div />}
        </nav>
      </article>
    </div>
  );
}