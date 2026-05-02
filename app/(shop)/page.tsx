import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  Search,
  ChevronRight,
  Microscope,
  MessageSquare,
  BarChart3,
  BookOpen,
  ArrowRight,
  FlaskConical,
  FileText,
  TrendingUp,
  Award,
  Sparkles,
  CalendarDays,
} from 'lucide-react'
import ProductCard from '@/components/product/ProductCard'
import CitationStats from '@/components/citations/CitationStats'
import HeroBackground from '@/components/animation/HeroBackground'

interface RecentPaper {
  title: string
  journal: string
  impact_factor: number
  publication_date: string
  doi: string
  product_cat_no: string
  authors: string
}

interface CitationData {
  total_citations: number
  total_if: number
  max_single_if: number
  max_single_journal: string
  monthly_growth: number
  recent_papers: RecentPaper[]
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ species?: string }>
}) {
  const { species: speciesFilter } = await searchParams
  const activeSpecies = speciesFilter || 'all'

  const supabase = await createClient()

  // Real counts
  const { count: productCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')

  const { count: paperCount } = await supabase
    .from('papers')
    .select('*', { count: 'exact', head: true })
    .eq('upload_status', 'verified')
    .eq('is_displayed', true)

  // Species list + count
  const { data: speciesRows } = await supabase
    .from('product_species')
    .select('species')
    .order('species')
  const speciesList = [...new Set(speciesRows?.map((r) => r.species) || [])]

  // Products for display
  let productIds: string[] | null = null
  if (activeSpecies !== 'all') {
    const { data } = await supabase
      .from('product_species')
      .select('product_id')
      .eq('species', activeSpecies)
    productIds = data?.map((r) => r.product_id) || []
  }

  let query = supabase
    .from('products')
    .select('*, product_species(species)')
    .eq('status', 'active')
    .order('is_featured', { ascending: false })

  if (activeSpecies !== 'all' && productIds && productIds.length > 0) {
    query = query.in('id', productIds)
  } else if (activeSpecies !== 'all') {
    query = query.eq('id', '00000000-0000-0000-0000-000000000000')
  }

  const { data: products } = await query.limit(8)

  // Daily knowledge
  const today = new Date().toISOString().split('T')[0]
  const { data: knowledgeItems } = await supabase
    .from('daily_knowledge')
    .select('id, date, title, summary, category, tags, is_hot')
    .eq('lifecycle_status', 'active')
    .order('date', { ascending: false })
    .limit(4)

  const todayKnowledge = knowledgeItems?.find((k) => k.date === today)
  const recentKnowledge = knowledgeItems?.filter((k) => k.date !== today).slice(0, 3) || []

  // Citation stats (direct Supabase query for Server Component)
  let citationStats: CitationData | null = null
  try {
    const { data: papers } = await supabase
      .from('papers')
      .select('impact_factor, journal, publication_date, title, doi, product_cat_no, authors')
      .eq('upload_status', 'verified')
      .eq('is_displayed', true)
      .order('publication_date', { ascending: false })

    const total = papers?.length || 0
    const totalIF = papers?.reduce((sum: number, p: any) => sum + (p.impact_factor || 0), 0) || 0
    const maxPaper = papers?.reduce((max: any, p: any) => ((p.impact_factor || 0) > (max?.impact_factor || 0) ? p : max), papers?.[0])

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthly = papers?.filter((p: any) => p.publication_date && p.publication_date >= monthStart).length || 0

    citationStats = {
      total_citations: total,
      total_if: Math.round(totalIF * 10) / 10,
      max_single_if: maxPaper?.impact_factor || 0,
      max_single_journal: maxPaper?.journal || '',
      monthly_growth: monthly,
      recent_papers: (papers || []).slice(0, 5).map((p: any) => ({
        title: p.title,
        journal: p.journal,
        impact_factor: p.impact_factor,
        publication_date: p.publication_date,
        doi: p.doi,
        product_cat_no: p.product_cat_no,
        authors: p.authors,
      })),
    }
  } catch {
    // ignore
  }

  const totalProducts = productCount || 0
  const totalPapers = paperCount || 0
  const totalSpecies = speciesList.length

  const features = [
    {
      href: '/search',
      icon: <Microscope className="w-6 h-6" />,
      title: '产品搜索',
      desc: `${totalProducts.toLocaleString()}+ 试剂盒，智能匹配靶标与种属`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      href: '/chat',
      icon: <MessageSquare className="w-6 h-6" />,
      title: 'AI 智能客服',
      desc: '售前/售后/方案咨询，7×24 在线',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      href: '/lab/analysis',
      icon: <BarChart3 className="w-6 h-6" />,
      title: '数据分析',
      desc: '4PL 拟合、标准曲线、实验报告',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      href: '/datasheet',
      icon: <BookOpen className="w-6 h-6" />,
      title: '智能说明书',
      desc: 'AI 一键生成专业产品说明书',
      color: 'text-sky-600',
      bg: 'bg-sky-50',
    },
  ]

  return (
    <div className="min-h-full">
      {/* Section 1: Hero */}
      <HeroBackground>
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-sm font-medium mb-8">
              <Sparkles className="w-3.5 h-3.5" />
              AI 驱动的 ELISA 试剂盒平台
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-900 leading-[1.1] mb-6">
              让每一次
              <br />
              <span className="text-gradient">ELISA 实验</span>
              <br />
              都精准可靠
            </h1>
            <p className="text-lg md:text-xl text-slate-600 leading-relaxed mb-10 max-w-xl">
              为科研工作者提供智能搜索、实验设计与数据分析，覆盖 {totalProducts.toLocaleString()}+ 试剂盒，覆盖 {totalSpecies}+ 种属
            </p>

            {/* Search */}
            <form action="/search" className="flex max-w-xl mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  name="q"
                  type="text"
                  placeholder="搜索靶标、种属、别名..."
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-l-xl text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-base"
                />
              </div>
              <button
                type="submit"
                className="px-8 py-4 bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-500 text-white rounded-r-xl font-semibold hover:opacity-90 transition-opacity"
              >
                搜索
              </button>
            </form>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/lab/experiment"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-blue-600 via-emerald-500 to-purple-500 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                <FlaskConical className="w-4 h-4" />
                设计实验方案
              </Link>
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold hover:border-slate-300 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                咨询 AI 客服
              </Link>
            </div>
          </div>
        </div>
      </HeroBackground>

      {/* Section 2: Stats Bar */}
      <section className="border-y border-slate-200 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: `${totalProducts.toLocaleString()}+`, label: '试剂盒', icon: <Microscope className="w-5 h-5 text-blue-600" /> },
              { value: `${totalPapers.toLocaleString()}`, label: 'SCI 引用', icon: <FileText className="w-5 h-5 text-emerald-600" /> },
              { value: `${totalSpecies}+`, label: '种属覆盖', icon: <TrendingUp className="w-5 h-5 text-violet-600" /> },
              { value: '24h', label: 'AI 在线响应', icon: <Sparkles className="w-5 h-5 text-sky-600" /> },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                  {stat.icon}
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-sm text-slate-500">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Feature Cards */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-4">
              一站式科研服务平台
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              从试剂盒搜索到实验设计，从数据分析到文献管理，全方位助力您的科研
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="group bg-white border border-slate-200 rounded-xl p-8 hover:border-transparent hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-emerald-50/30 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl ${f.bg} ${f.color} flex items-center justify-center mb-5 group-hover:scale-105 transition-transform`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  了解更多 <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4: Products */}
      <section className="bg-slate-50 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2">
                热门产品
              </h2>
              <p className="text-lg text-slate-600">{totalProducts.toLocaleString()}+ 试剂盒现货供应</p>
            </div>
            <Link
              href="/search"
              className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Species Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-6 mb-2">
            <Link
              href="/"
              className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                activeSpecies === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
              }`}
            >
              全部
            </Link>
            {speciesList.map((s) => (
              <Link
                key={s}
                href={`/?species=${s}`}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeSpecies === s
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                }`}
              >
                {s}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products?.map((product) => (
              <ProductCard
                key={product.id}
                product={{
                  id: product.id,
                  name: product.name,
                  slug: product.slug,
                  target: product.target,
                  price: product.price,
                  detection_range: product.detection_range,
                  stock_status: product.stock_status,
                  citation_count: product.citation_count,
                }}
                species={(product.product_species as any[])
                  ?.map((s: any) => s.species)}
              />
            ))}
          </div>

          {(!products || products.length === 0) && (
            <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-lg">暂无产品</p>
            </div>
          )}

          <div className="mt-10 text-center md:hidden">
            <Link
              href="/search"
              className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Section 5: Citations */}
      <section className="bg-white py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2">
                文献影响力
              </h2>
              <p className="text-lg text-slate-600">基于 SCI 期刊的真实引用数据</p>
            </div>
            <Link
              href="/citations"
              className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <CitationStats initialStats={citationStats || undefined} />
        </div>
      </section>

      {/* Section 6: Daily Knowledge */}
      <section className="bg-slate-50 py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-2">
                每日知识
              </h2>
              <p className="text-lg text-slate-600">每天学习一点 ELISA 专业知识</p>
            </div>
            <Link
              href="/knowledge"
              className="hidden md:inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              查看全部 <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Today's Article */}
            {todayKnowledge ? (
              <Link
                href={`/knowledge/${todayKnowledge.date}`}
                className="lg:col-span-2 group bg-white border border-slate-200 rounded-xl p-8 hover:border-transparent hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-emerald-50/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                    <CalendarDays className="w-3 h-3" />
                    今日知识
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                    {todayKnowledge.category}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors">
                  {todayKnowledge.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-4 line-clamp-3">
                  {todayKnowledge.summary}
                </p>
                <div className="flex items-center gap-2">
                  {todayKnowledge.tags?.slice(0, 4).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ) : recentKnowledge.length > 0 ? (
              <Link
                href={`/knowledge/${recentKnowledge[0].date}`}
                className="lg:col-span-2 group bg-white border border-slate-200 rounded-xl p-8 hover:border-transparent hover:bg-gradient-to-br hover:from-blue-50/50 hover:to-emerald-50/30 transition-all"
              >
                <div className="flex items-center gap-2 mb-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
                    <Sparkles className="w-3 h-3" />
                    最新知识
                  </span>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                    {recentKnowledge[0].category}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-blue-700 transition-colors">
                  {recentKnowledge[0].title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-4 line-clamp-3">
                  {recentKnowledge[0].summary}
                </p>
                <div className="flex items-center gap-2">
                  {recentKnowledge[0].tags?.slice(0, 4).map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-xs rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </Link>
            ) : (
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-8 flex items-center justify-center">
                <p className="text-slate-400">暂无知识文章</p>
              </div>
            )}

            {/* Recent Small Cards */}
            <div className="space-y-4">
              {(todayKnowledge ? recentKnowledge : recentKnowledge.slice(1)).slice(0, 3).map((k) => (
                <Link
                  key={k.id}
                  href={`/knowledge/${k.date}`}
                  className="block group bg-white border border-slate-200 rounded-xl p-5 hover:border-transparent hover:bg-gradient-to-br hover:from-blue-50/30 hover:to-emerald-50/20 transition-all"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-slate-400">{k.date}</span>
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                      {k.category}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-900 line-clamp-2 group-hover:text-blue-700 transition-colors">
                    {k.title}
                  </h4>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 7: CTA + Footer */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-emerald-500 to-purple-500" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.05%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-6 md:px-8 py-24 md:py-32 text-center">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-6">
            开始您的科研之旅
          </h2>
          <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto mb-10">
            覆盖 {totalSpecies}+ 种属，{totalProducts.toLocaleString()}+ 试剂盒，体验 AI 驱动的 ELISA 平台
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/search"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-lg font-bold hover:bg-blue-50 transition-colors"
            >
              <Microscope className="w-5 h-5" />
              浏览产品
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/30 rounded-lg font-bold hover:bg-white/20 transition-colors"
            >
              <Sparkles className="w-5 h-5" />
              免费注册
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center">
                  <FlaskConical className="w-4.5 h-4.5 text-white" />
                </div>
                <span className="text-white font-black text-lg tracking-tight">Animal Union</span>
              </div>
              <p className="text-sm leading-relaxed max-w-sm">
                AI 驱动的 ELISA 试剂盒平台，为科研工作者提供智能搜索、实验设计与数据分析服务。
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">产品服务</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/search" className="hover:text-white transition-colors">试剂盒搜索</Link></li>
                <li><Link href="/lab/experiment" className="hover:text-white transition-colors">实验方案</Link></li>
                <li><Link href="/lab/analysis" className="hover:text-white transition-colors">数据分析</Link></li>
                <li><Link href="/datasheet" className="hover:text-white transition-colors">说明书生成</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">关于我们</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/citations" className="hover:text-white transition-colors">文献引用</Link></li>
                <li><Link href="/knowledge" className="hover:text-white transition-colors">每日知识</Link></li>
                <li><Link href="/store" className="hover:text-white transition-colors">积分商城</Link></li>
                <li><Link href="/chat" className="hover:text-white transition-colors">AI 客服</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-800 text-sm text-center">
            &copy; {new Date().getFullYear()} Animal Union 爱萌优宁. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
