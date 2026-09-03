'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileBarChart,
  MessageCircle,
  PlayCircle,
  Radio,
  Search,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { DEFAULT_HOME_MEDIA_ITEMS, getHomeMediaLaunchHref, hasUsableHomeMediaLink, isPlayableHomeMediaItem, isPlayableHomeMediaUrl, type HomeMediaCategory, type HomeMediaItem } from '@/lib/home-media';
import HomeHeroCarousel from '@/components/home/HomeHeroCarousel';

// ── Supabase Client ─────────────────────────
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;
try {
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (sbUrl && sbKey && sbUrl !== 'your-supabase-url') {
    supabase = createClient(sbUrl, sbKey);
  }
} catch { /* no supabase */ }

const LS_KEY = 'aimeng_homepage_content';

type HomepageContent = {
  footer_copyright: string;
};

function isHomepageContent(value: unknown): value is Partial<HomepageContent> {
  return typeof value === 'object' && value !== null;
}

function loadFromLocal(): Partial<HomepageContent> | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return isHomepageContent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ── InlineEdit ──────────────────────────────
function InlineEdit({ isEditMode, value, onChange, className = '', multiline = false }: {
  isEditMode: boolean; value: string; onChange: (v: string) => void;
  className?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  if (!isEditMode) return <span className={className}>{value}</span>;
  if (editing) {
    const inputClass = "bg-blue-50 border-2 border-blue-400 rounded-lg px-2 py-1 text-inherit outline-none " + (multiline ? "resize-none min-w-[200px] min-h-[60px]" : "min-w-[120px]");
    return multiline ? (
      <textarea value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => { onChange(editVal); setEditing(false); }} autoFocus className={inputClass} rows={3} />
    ) : (
      <input type="text" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={() => { onChange(editVal); setEditing(false); }} onKeyDown={e => { if (e.key === 'Enter') { onChange(editVal); setEditing(false); } }} autoFocus className={inputClass} />
    );
  }
  return (
    <span onClick={() => { setEditVal(value); setEditing(true); }} className={`cursor-pointer border-b-2 border-dashed border-blue-300 hover:bg-blue-50/50 ${className}`} title="点击编辑">
      {value}
    </span>
  );
}

// ── DEFAULT CONTENT ─────────────────────────
const DEFAULT_CONTENT: HomepageContent = {
  footer_copyright: '© 2025 AIMENG UNING 爱萌优宁. All rights reserved.',
};

function normalizeEntryQuery(value: string) {
  return value.normalize('NFKC').trim();
}

function isLikelyCatalogQuery(value: string) {
  const compact = normalizeEntryQuery(value).toUpperCase().replace(/\s+/g, '');
  return /^[A-Z]{1,10}-?\d{3,}[A-Z]?$/.test(compact);
}

function hasCoaIntent(value: string) {
  return /coa|质检|质控|检测报告|批号|批次/i.test(value);
}

function hasAiQuestionIntent(value: string) {
  return /[?？]|怎么|如何|为什么|原因|方案|操作|步骤|注意|处理|稀释|标准曲线|不准|失败|异常|优化|应用场景|区别|建议/.test(value);
}

function getHomeEntryHref(query: string) {
  const trimmed = normalizeEntryQuery(query);
  if (!trimmed) return '/products/elisa';

  const encoded = encodeURIComponent(trimmed);
  if (isLikelyCatalogQuery(trimmed)) return `/products/elisa?q=${encoded}`;
  if (hasCoaIntent(trimmed)) return `/products/coa?catalog=${encoded}`;
  if (hasAiQuestionIntent(trimmed)) return `/chat?mode=protocol&question=${encoded}`;
  return `/products/elisa?q=${encoded}`;
}

// ── MAIN PAGE ───────────────────────────────
export default function HomePage() {
  const isEditMode = false;
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [heroQuery, setHeroQuery] = useState('');
  const [mediaItems, setMediaItems] = useState<HomeMediaItem[]>(DEFAULT_HOME_MEDIA_ITEMS);

  useEffect(() => {
    async function load() {
      if (supabase) {
        try {
          const { data } = await supabase.from('site_settings').select('homepage_content').eq('id', 1).single();
          const homepageContent = data?.homepage_content as Partial<HomepageContent> | undefined;
          if (homepageContent) { setContent({ ...DEFAULT_CONTENT, ...homepageContent }); return; }
        } catch { /* fallback */ }
      }
      const local = loadFromLocal();
      if (local) setContent({ ...DEFAULT_CONTENT, ...local });
    }
    load();
  }, []);

  useEffect(() => {
    async function loadMedia() {
      try {
        const res = await fetch('/api/home-media', { cache: 'no-store' })
        const data = await res.json()
        if (res.ok && Array.isArray(data.items) && data.items.length > 0) {
          setMediaItems(data.items)
        }
      } catch {
        setMediaItems(DEFAULT_HOME_MEDIA_ITEMS)
      }
    }
    loadMedia()
  }, [])

  const handleUpdate = useCallback((key: keyof HomepageContent, value: string) => {
    setContent(prev => { const n = { ...prev }; n[key] = value; return n; });
  }, []);

  const handleHeroSearch = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    window.location.href = getHomeEntryHref(heroQuery);
  }, [heroQuery]);

  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B] relative">
      <main>
        <HomeIntelligenceHero query={heroQuery} onQueryChange={setHeroQuery} onSubmit={handleHeroSearch} />
        <HomeMediaShowcase items={mediaItems} />
        <HomeSupportStrip />
      </main>

      <Footer content={content} isEditMode={isEditMode} onUpdate={handleUpdate} />
    </div>
  );
}

function HomeIntelligenceHero({
  query,
  onQueryChange,
  onSubmit,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const quickActions = [
    { icon: Search, label: '产品检索', href: '/products/elisa' },
    { icon: ClipboardCheck, label: 'COA 查询', href: '/products/coa' },
    { icon: FileBarChart, label: 'ELISA 数据分析', href: '/lab/analysis' },
    { icon: MessageCircle, label: '联系客服', href: '/contact#contact-info' },
  ];

  return (
    <section className="relative isolate overflow-hidden bg-white px-4 py-16 md:py-20">
      <TechHeroBackground />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#ffffff_0%,rgba(248,251,253,0.94)_50%,rgba(235,250,255,0.62)_100%)]" />

      <div className="mx-auto max-w-7xl">
        <HomeHeroCarousel variant="hero" />

        <div className="mt-12 grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-end">
          <div className="text-left">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.28em] text-teal-700">
              aimeng.service.entry / ready
            </p>
            <h1 className="mt-4 max-w-2xl text-3xl font-black leading-tight tracking-normal text-slate-950 md:text-5xl">
              爱萌优宁 ELISA 与细胞培养产品服务平台
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              产品检索、说明书、COA、ELISA 数据分析和实验问题咨询，集中进入一个更快的实验服务入口。
            </p>
          </div>

          <div>
            <form onSubmit={onSubmit} className="border-b border-slate-300 pb-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="sr-only" htmlFor="home-intelligent-entry">输入靶标、货号、批号或实验问题</label>
                <div className="flex min-h-12 flex-1 items-center gap-3">
                  <span className="font-mono text-sm font-bold text-teal-700">&gt;</span>
                  <input
                    id="home-intelligent-entry"
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="输入靶标 / 货号 / COA 批号 / 实验问题"
                    className="w-full bg-transparent text-base font-semibold text-slate-950 outline-none placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-none bg-slate-950 px-6 text-sm font-bold text-white transition hover:bg-teal-700"
                >
                  RUN QUERY <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </form>

            <div className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group inline-flex items-center justify-between border-b border-slate-200 py-3 text-sm font-bold text-slate-800 transition hover:border-teal-500 hover:text-teal-800"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              );
            })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TechHeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvasElement = canvasRef.current;

    const context = canvasElement.getContext('2d');
    if (!context) return;
    const ctx = context;

    let width = 0;
    let height = 0;
    let frame = 0;
    let raf = 0;

    const nodes = Array.from({ length: 36 }, (_, index) => ({
      x: 0.42 + ((index * 37) % 58) / 100,
      y: 0.08 + ((index * 23) % 78) / 100,
      phase: index * 0.73,
      speed: 0.55 + (index % 5) * 0.08,
    }));

    function resize() {
      const rect = canvasElement.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvasElement.width = Math.max(1, Math.floor(width * ratio));
      canvasElement.height = Math.max(1, Math.floor(height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function drawGrid(time: number) {
      const grid = 56;
      ctx.strokeStyle = 'rgba(14, 116, 144, 0.075)';
      ctx.lineWidth = 1;

      for (let x = -grid; x < width + grid; x += grid) {
        const offset = (time * 0.018) % grid;
        ctx.beginPath();
        ctx.moveTo(x + offset, 0);
        ctx.lineTo(x + offset, height);
        ctx.stroke();
      }

      for (let y = -grid; y < height + grid; y += grid) {
        const offset = (time * 0.012) % grid;
        ctx.beginPath();
        ctx.moveTo(0, y + offset);
        ctx.lineTo(width, y + offset);
        ctx.stroke();
      }
    }

    function draw() {
      frame += 1;
      const time = frame / 60;
      ctx.clearRect(0, 0, width, height);

      const haze = ctx.createLinearGradient(width * 0.34, 0, width, height);
      haze.addColorStop(0, 'rgba(20, 184, 166, 0.06)');
      haze.addColorStop(0.46, 'rgba(14, 165, 233, 0.10)');
      haze.addColorStop(1, 'rgba(15, 23, 42, 0.03)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, width, height);

      drawGrid(time);

      const points = nodes.map((node) => {
        const driftX = Math.sin(time * node.speed + node.phase) * 18;
        const driftY = Math.cos(time * node.speed * 0.85 + node.phase) * 14;
        return {
          x: node.x * width + driftX,
          y: node.y * height + driftY,
          glow: 0.42 + Math.sin(time * 1.7 + node.phase) * 0.22,
        };
      });

      for (let i = 0; i < points.length; i += 1) {
        for (let j = i + 1; j < points.length; j += 1) {
          const a = points[i];
          const b = points[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > 145) continue;

          const alpha = (1 - distance / 145) * 0.16;
          ctx.strokeStyle = `rgba(8, 145, 178, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      for (const point of points) {
        ctx.fillStyle = `rgba(6, 182, 212, ${point.glow})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(45, 212, 191, ${point.glow * 0.24})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8 + point.glow * 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      const sweepX = ((time * 92) % (width * 1.18)) - width * 0.08;
      const sweep = ctx.createLinearGradient(sweepX - 90, 0, sweepX + 90, 0);
      sweep.addColorStop(0, 'rgba(14, 165, 233, 0)');
      sweep.addColorStop(0.5, 'rgba(14, 165, 233, 0.12)');
      sweep.addColorStop(1, 'rgba(14, 165, 233, 0)');
      ctx.fillStyle = sweep;
      ctx.fillRect(sweepX - 90, 0, 180, height);

      raf = requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 -z-20 h-full w-full opacity-90"
    />
  );
}

function HomeMediaShowcase({ items }: { items: HomeMediaItem[] }) {
  const getCategoryItems = (category: HomeMediaCategory) => sortHomeMediaByAdminOrder(
    items.filter((item) => item.category === category && item.is_active)
  );

  const elisaItems = getCategoryItems('elisa');
  const cellItems = getCategoryItems('cell_culture');
  const elisaQueue = elisaItems.length ? elisaItems : DEFAULT_HOME_MEDIA_ITEMS.filter((item) => item.category === 'elisa');
  const cellQueue = cellItems.length ? cellItems : DEFAULT_HOME_MEDIA_ITEMS.filter((item) => item.category === 'cell_culture');
  const elisaFeatured = pickFeaturedMedia(elisaQueue, DEFAULT_HOME_MEDIA_ITEMS[0]);
  const cellFeatured = pickFeaturedMedia(cellQueue, DEFAULT_HOME_MEDIA_ITEMS[3]);

  return (
    <section className="bg-white px-4 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-9 max-w-3xl">
          <span className="text-sm font-bold uppercase tracking-widest text-teal-700">Media Studio</span>
          <h2 className="mt-4 text-3xl font-black tracking-normal text-slate-950">会说话的实验视频窗口</h2>
          <p className="mt-4 text-base leading-8 text-slate-600">
            ELISA 和细胞培养分开叙事，本地视频在首页直接播放，外部平台内容点击后跳转观看。
          </p>
        </div>

        <div className="space-y-8">
          <MediaSection
            title="ELISA 实验现场"
            eyebrow="ELISA"
            description="从加样、孵育、洗板到数据分析，把客户最关心的实验节点讲清楚。"
            featured={elisaFeatured}
            imageSrc={elisaFeatured.cover_image_url || '/images/elisa/elisa_sandwich_pencil.jpg'}
            imageAlt="ELISA 实验视频封面"
            accentClassName="bg-cyan-500 text-white"
            news={elisaQueue}
          />
          <MediaSection
            title="细胞培养观察室"
            eyebrow="Cell Culture"
            description="围绕细胞状态、血清选择、污染判断和传代节奏，做成连续可追踪的内容流。"
            featured={cellFeatured}
            imageSrc={cellFeatured.cover_image_url || '/images/elisa/elisa_sandwich_lego.jpg'}
            imageAlt="细胞培养视频封面"
            accentClassName="bg-emerald-500 text-white"
            news={cellQueue}
          />
        </div>
      </div>
    </section>
  );
}

function pickFeaturedMedia(items: HomeMediaItem[], fallback: HomeMediaItem) {
  const playableItems = items.filter((item) => isPlayableHomeMediaItem(item));
  const realItems = items.filter((item) => hasUsableHomeMediaLink(item));
  return playableItems.find((item) => item.is_featured)
    || playableItems[0]
    || realItems.find((item) => item.is_featured)
    || realItems[0]
    || items.find((item) => item.is_featured)
    || items[0]
    || fallback;
}

function sortHomeMediaByAdminOrder(items: HomeMediaItem[]) {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const aUpdated = new Date(a.updated_at || a.published_at || a.created_at || 0).getTime();
    const bUpdated = new Date(b.updated_at || b.published_at || b.created_at || 0).getTime();
    return bUpdated - aUpdated;
  });
}

function getMediaPoster(item: HomeMediaItem, fallbackImage: string) {
  return item.cover_image_url || fallbackImage;
}

function getMediaPreviewScenes(category: HomeMediaCategory) {
  if (category === 'cell_culture') {
    return [
      { label: '状态观察', copy: '先看细胞形态、密度和贴壁状态。' },
      { label: '血清选择', copy: '根据细胞类型选择更稳定的血清批次。' },
      { label: '污染排查', copy: '把浑浊、漂浮物和生长异常分开判断。' },
      { label: '传代节奏', copy: '用细胞状态决定传代比例和换液时间。' },
    ];
  }

  return [
    { label: '加样准备', copy: '先确认样本、标准品、复孔和板位。' },
    { label: '孵育洗板', copy: '控制时间、温度和洗板一致性。' },
    { label: '显色终止', copy: '观察显色窗口，避免过度反应。' },
    { label: '读数分析', copy: '进入 4PL 拟合和报告生成。' },
  ];
}

function MediaSection({
  title,
  eyebrow,
  description,
  featured,
  imageSrc,
  imageAlt,
  accentClassName,
  news,
}: {
  title: string;
  eyebrow: string;
  description: string;
  featured: HomeMediaItem;
  imageSrc: string;
  imageAlt: string;
  accentClassName: string;
  news: HomeMediaItem[];
}) {
  const [muted, setMuted] = useState(true);
  const directoryItems = news;
  const [selectedId, setSelectedId] = useState(featured.id);
  const selectedItem = useMemo(
    () => directoryItems.find((item) => item.id === selectedId) || featured,
    [directoryItems, featured, selectedId]
  );
  const selectedHref = getHomeMediaLaunchHref(selectedItem);
  const selectedImage = getMediaPoster(selectedItem, imageSrc);
  const canPlayInline = isPlayableHomeMediaUrl(selectedItem.external_url);
  const entryLabel = selectedItem.platform === '本地视频' && !canPlayInline
    ? '视频地址待完善'
    : selectedItem.platform === '本地视频' || canPlayInline
    ? '打开视频页'
    : selectedItem.platform
      ? `进入${selectedItem.platform}`
      : '进入视频库';
  const selectedSummary = selectedItem.summary || description;
  const [previewIndex, setPreviewIndex] = useState(0);
  const previewScenes = getMediaPreviewScenes(selectedItem.category);
  const currentScene = previewScenes[previewIndex % previewScenes.length];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 后台精选视频切换后，需要同步当前选中的视频卡片。
    setSelectedId(featured.id);
  }, [featured.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 后台自媒体数据加载完成后，频道动画脚本从第一幕重新开始。
    setPreviewIndex(0);
  }, [selectedItem.id]);

  useEffect(() => {
    if (canPlayInline) return;
    const timer = window.setInterval(() => {
      setPreviewIndex((current) => current + 1);
    }, 2600);
    return () => window.clearInterval(timer);
  }, [selectedItem.id, canPlayInline]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.16fr_0.84fr]">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-[#09111F] text-white shadow-sm">
        <div className="relative aspect-video overflow-hidden bg-slate-950">
          {canPlayInline ? (
            <video
              key={selectedItem.id}
              src={selectedItem.external_url}
              poster={selectedImage}
              autoPlay
              muted={muted}
              loop
              playsInline
              preload="metadata"
              controls
              onCanPlay={(event) => {
                event.currentTarget.play().catch(() => {})
              }}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="relative h-full w-full">
              <Image
                src={selectedImage}
                alt={imageAlt}
                width={1344}
                height={768}
                className="media-kenburns h-full w-full object-cover opacity-85"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_22%,rgba(34,211,238,0.26),transparent_32%),linear-gradient(90deg,rgba(9,17,31,0.92),rgba(9,17,31,0.36)_55%,rgba(9,17,31,0.72))]" />
              <div className="media-scan absolute inset-x-0 top-0 h-px bg-cyan-300/80 shadow-[0_0_24px_rgba(34,211,238,0.9)]" />
              <div className="media-orbit absolute right-[13%] top-[17%] h-32 w-32 rounded-full border border-cyan-300/35" />
              <div className="media-orbit-inner absolute right-[18%] top-[28%] h-12 w-12 rounded-full border border-emerald-300/50" />

              <div key={`${selectedItem.id}-${currentScene.label}`} className="media-scene-card absolute left-6 top-[34%] hidden max-w-[270px] rounded-lg border border-white/15 bg-slate-950/55 p-4 shadow-2xl backdrop-blur md:block">
                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-cyan-200">Preview Script</div>
                <div className="mt-2 text-xl font-black text-white">{currentScene.label}</div>
                <p className="mt-2 text-sm leading-6 text-slate-200">{currentScene.copy}</p>
                <div className="mt-4 flex gap-1.5">
                  {previewScenes.map((scene, index) => (
                    <span
                      key={scene.label}
                      className={`h-1.5 flex-1 rounded-full ${index === previewIndex % previewScenes.length ? 'bg-cyan-300' : 'bg-white/20'}`}
                    />
                  ))}
                </div>
              </div>

              <div className="absolute bottom-6 right-6 hidden w-44 rounded-md border border-white/15 bg-white/10 p-3 backdrop-blur md:block">
                <div className="media-data-title h-1.5 w-20 rounded-full bg-cyan-200" />
                <div className="mt-3 grid grid-cols-5 gap-1">
                  {Array.from({ length: 15 }).map((_, index) => (
                    <span
                      key={index}
                      className="media-data-bar h-1.5 rounded-full bg-white/25"
                      style={{ animationDelay: `${index * 90}ms` }}
                    />
                  ))}
                </div>
              </div>

              <style jsx>{`
                @keyframes mediaKenBurns {
                  0% { transform: scale(1) translate3d(0, 0, 0); filter: saturate(0.95); }
                  50% { transform: scale(1.08) translate3d(-1.6%, -1.2%, 0); filter: saturate(1.12); }
                  100% { transform: scale(1) translate3d(0, 0, 0); filter: saturate(0.95); }
                }
                @keyframes mediaScan {
                  0% { transform: translateY(0); opacity: 0; }
                  8% { opacity: 1; }
                  92% { opacity: 1; }
                  100% { transform: translateY(420px); opacity: 0; }
                }
                @keyframes mediaOrbit {
                  0% { transform: scale(0.84); opacity: 0.32; }
                  50% { transform: scale(1.08); opacity: 0.72; }
                  100% { transform: scale(0.84); opacity: 0.32; }
                }
                @keyframes mediaSceneIn {
                  0% { transform: translateY(10px); opacity: 0; }
                  18% { transform: translateY(0); opacity: 1; }
                  82% { transform: translateY(0); opacity: 1; }
                  100% { transform: translateY(-8px); opacity: 0; }
                }
                @keyframes mediaData {
                  0%, 100% { transform: scaleX(0.34); opacity: 0.25; }
                  50% { transform: scaleX(1); opacity: 0.78; }
                }
                .media-kenburns {
                  animation: mediaKenBurns 9s ease-in-out infinite;
                  transform-origin: center;
                }
                .media-scan {
                  animation: mediaScan 3.6s linear infinite;
                }
                .media-orbit {
                  animation: mediaOrbit 3.8s ease-in-out infinite;
                }
                .media-orbit-inner {
                  animation: mediaOrbit 2.6s ease-in-out infinite reverse;
                }
                .media-scene-card {
                  animation: mediaSceneIn 2.6s ease-in-out both;
                }
                .media-data-title {
                  animation: mediaData 1.8s ease-in-out infinite;
                  transform-origin: left;
                }
                .media-data-bar {
                  animation: mediaData 1.4s ease-in-out infinite;
                  transform-origin: left;
                }
              `}</style>
            </div>
          )}

          <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black ${accentClassName}`}>
              <Radio className="h-3.5 w-3.5" />
              {eyebrow}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
              {canPlayInline ? '正在播放' : '动态预览'}
            </span>
          </div>

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/82 to-transparent p-5 md:p-7">
            <div className="max-w-2xl">
              <h3 className="text-2xl font-black leading-tight tracking-normal md:text-4xl">{title}</h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 md:text-base">{selectedSummary}</p>
              <p className="mt-2 text-xs font-semibold text-cyan-100/80">
                {selectedItem.title}
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <SmartMediaLink
                  href={selectedHref}
                  className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-50"
                >
                  {canPlayInline ? '播放精选视频' : '进入精选视频'} <ExternalLink className="h-4 w-4" />
                </SmartMediaLink>
                {canPlayInline && (
                  <button
                    type="button"
                    onClick={() => setMuted((current) => !current)}
                    className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    {muted ? '开启声音' : '静音'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Video Directory</span>
            <h4 className="mt-2 text-2xl font-black tracking-normal text-slate-950">视频目录</h4>
          </div>
          <SmartMediaLink href={selectedHref} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
            {entryLabel}
          </SmartMediaLink>
        </div>
        <div className="mt-5 max-h-[330px] space-y-3 overflow-y-auto pr-1">
          {directoryItems.map((item) => (
            <MediaDirectoryCard
              key={item.id}
              item={item}
              active={item.id === selectedItem.id}
              onSelect={() => setSelectedId(item.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MediaDirectoryCard({
  item,
  active,
  onSelect,
}: {
  item: HomeMediaItem;
  active: boolean;
  onSelect: () => void;
}) {
  const hasLink = hasUsableHomeMediaLink(item);
  const badge = isPlayableHomeMediaUrl(item.external_url)
    ? '本地视频'
    : hasLink
      ? item.platform || '外链'
      : item.platform === '本地视频'
        ? '视频待绑定'
        : '链接待完善';
  const className = `grid w-full grid-cols-[88px_1fr_auto] items-center gap-3 rounded-lg border px-3 py-3 text-left transition ${
    active
      ? 'border-cyan-300 bg-cyan-50 shadow-sm'
      : hasLink
        ? 'border-slate-100 bg-slate-50 hover:border-cyan-200 hover:bg-cyan-50'
        : 'cursor-default border-amber-100 bg-amber-50/70'
  }`;

  const content = (
    <>
      <div className="relative aspect-video overflow-hidden rounded-md bg-slate-200">
        {item.cover_image_url ? (
          <Image
            src={item.cover_image_url}
            alt=""
            width={352}
            height={198}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,#E0F2FE,#ECFDF5)]" />
        )}
        <div className="absolute inset-0 grid place-items-center bg-slate-950/20">
          <PlayCircle className="h-6 w-6 text-white drop-shadow" />
        </div>
      </div>
      <div className="min-w-0">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
          hasLink ? 'bg-blue-50 text-blue-700' : 'bg-amber-100 text-amber-800'
        }`}>
          {badge}
        </span>
        <p className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-800">{item.title}</p>
        <p className="mt-1 text-xs text-slate-400">{hasLink ? item.platform || '视频内容' : '后台需要重新绑定视频地址'}</p>
      </div>
      <ChevronRight className={`h-4 w-4 shrink-0 ${hasLink ? 'text-slate-300' : 'text-amber-500'}`} />
    </>
  );

  if (!hasLink) {
    return <div className={className} title="该内容还没有有效的视频地址，无法播放或跳转。">{content}</div>;
  }

  if (isPlayableHomeMediaUrl(item.external_url)) {
    return (
      <button type="button" onClick={onSelect} className={className}>
        {content}
      </button>
    );
  }

  return (
    <SmartMediaLink href={getHomeMediaLaunchHref(item)} className={className}>
      {content}
    </SmartMediaLink>
  );
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith('//');
}

function SmartMediaLink({
  href,
  className,
  children,
}: {
  href: string;
  className: string;
  children: ReactNode;
}) {
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href || '/videos'} className={className}>
      {children}
    </Link>
  );
}

function HomeSupportStrip() {
  const links = [
    { label: '每日知识', href: '/knowledge' },
    { label: '实验工具', href: '/lab/analysis' },
    { label: '积分商城', href: '/store' },
    { label: '全国代理商', href: '/agents' },
  ];

  return (
    <section className="bg-white px-4 py-14">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-lg border border-slate-200 bg-slate-950 p-7 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-normal">需要资料、选型或实验支持？</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            资料、工具、代理商和官方客服保持清晰分流，客户不用反复滚动寻找。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════
type FooterProps = {
  content: HomepageContent;
  isEditMode: boolean;
  onUpdate: (key: keyof HomepageContent, value: string) => void;
};

function Footer({ content, isEditMode, onUpdate }: FooterProps) {
  const contactEmail = 'service@animaluni.com';
  const footerSocialLinks = [
    { href: '/contact#contact-info', label: '查看官方联系方式', icon: 'fab fa-weixin', color: '#42BDD8' },
    { href: '/agents', label: '查看全国代理商', icon: 'fas fa-map-marker-alt', color: '#6B4584' },
    { href: `mailto:${contactEmail}`, label: '发送邮件给爱萌优宁', icon: 'fas fa-envelope', color: '#E1E600' },
  ];

  return (
    <footer className="bg-[#0b1120] text-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-1">
            <div className="mb-4">
              <Image
                src="/brand/footer-logo-transparent.png"
                alt="Animal Union R&D Service"
                width={360}
                height={137}
                className="h-auto w-48 sm:w-56"
                sizes="(max-width: 640px) 192px, 224px"
              />
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              专注 ELISA 试剂盒、细胞培养血清与实验数据服务，为科研客户提供产品资料、批次追溯和智能实验支持。
            </p>
            <div className="flex items-center gap-3">
              {footerSocialLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#0b1120] shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:brightness-110"
                  style={{ backgroundColor: item.color }}
                >
                  <i className={item.icon} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-5">常用入口</h4>
            <ul className="space-y-3">
              {[
                { label: 'AI服务中心', href: '/chat' },
                { label: '视频教程', href: '/videos' },
                { label: '每日知识', href: '/knowledge' },
                { label: '积分商城', href: '/store' },
                { label: '科研社区', href: '/community' },
              ].map((item) => (
                <li key={item.label}><Link href={item.href} className="text-slate-400 text-sm hover:text-blue-400 transition-colors">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-5">资料服务</h4>
            <ul className="space-y-3">
              {[
                { label: '产品搜索', href: '/products/elisa' },
                { label: '数据分析', href: '/lab/analysis' },
                { label: '文献引用', href: '/citations' },
                { label: '帮助中心', href: '/contact#contact-info' },
                { label: '代理商分布', href: '/agents' },
              ].map((item) => (
                <li key={item.label}><Link href={item.href} className="text-slate-400 text-sm hover:text-blue-400 transition-colors">{item.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-5">联系方式</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-slate-400 text-sm"><i className="fas fa-envelope text-blue-400" /><span>{contactEmail}</span></li>
              <li className="flex items-center gap-3 text-slate-400 text-sm"><i className="fas fa-map-marker-alt text-blue-400" /><span>Shanghai, China</span></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 mt-12 pt-8 text-center">
          <p className="text-slate-500 text-sm">
            <InlineEdit isEditMode={isEditMode} value={content.footer_copyright} onChange={(v: string) => onUpdate('footer_copyright', v)} />
          </p>
        </div>
      </div>
    </footer>
  );
}
