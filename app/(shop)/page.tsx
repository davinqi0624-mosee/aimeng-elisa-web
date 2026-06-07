'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FlaskConical, Video, MessageCircle, FileBarChart, BookOpen, Gift,
  ChevronRight, Search, Microscope, ArrowRight, Zap, Users, Award,
  Globe, ExternalLink, TrendingUp, Calculator, FileSpreadsheet, Coins, ShoppingBag,
  CheckCircle, BarChart3, LineChart, Sigma, Edit3, X, Save, Check
} from 'lucide-react';

// ── Supabase Client (initialized lazily in useEffect) ──────
let supabase: any = null;
function initSupabase() {
  if (supabase) return supabase;
  if (typeof window === 'undefined') return null;
  try {
    // Try @supabase/ssr (original project uses this)
    // @ts-ignore
    const mod = require('@supabase/ssr');
    const createClient = mod.createBrowserClient || mod.createClient;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) supabase = createClient(url, key);
  } catch {
    try {
      // @ts-ignore
      const mod = require('@supabase/supabase-js');
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) supabase = mod.createClient(url, key);
    } catch { /* supabase not available */ }
  }
  return supabase;
}

const LS_KEY = 'aimeng_homepage_content';
function loadFromLocal(): Record<string, any> | null {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return null; }
}
function saveToLocal(data: Record<string, any>) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

// ── InlineEdit (true inline editing) ────────────────────────
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

// ── EditModeToggle ──────────────────────────────────────────
function EditModeToggle({ isEditMode, onToggle, hasChanges, saveStatus, onSave }: {
  isEditMode: boolean; onToggle: () => void; hasChanges: boolean;
  saveStatus: string; onSave: () => void;
}) {
  return (
    <div className="fixed top-20 left-4 z-50 flex items-center gap-2">
      <button onClick={onToggle} className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-all ${isEditMode ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'}`}>
        {isEditMode ? <><X className="w-4 h-4" /> 退出编辑</> : <><Edit3 className="w-4 h-4" /> 编辑模式</>}
      </button>
      {isEditMode && (
        <button onClick={onSave} disabled={saveStatus === 'saving' || !hasChanges}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-lg transition-all ${saveStatus === 'saved' ? 'bg-green-500 text-white' : hasChanges ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}>
          {saveStatus === 'saving' ? <><Save className="w-4 h-4 animate-spin" /> 保存中...</> : saveStatus === 'saved' ? <><Check className="w-4 h-4" /> 已保存!</> : <><Save className="w-4 h-4" /> 保存</>}
        </button>
      )}
      {isEditMode && hasChanges && <span className="px-3 py-1 rounded-full bg-orange-500 text-white text-xs animate-pulse">有未保存更改</span>}
    </div>
  );
}

// ── DEFAULT CONTENT ─────────────────────────────────────────
const DEFAULT_CONTENT: Record<string, any> = {
  hero_tag: 'AI-POWERED BIOTECH PLATFORM',
  hero_title: 'AI赋能科研',
  hero_title_highlight: '重新定义实验',
  hero_subtitle: '从方案设计到数据报告，爱萌优宁AI助手全程陪伴您的每一个实验。DeepSeek大模型驱动，让科研更简单。',
  hero_button1: '开始实验之旅',
  hero_button2: '观看演示视频',
  stat1_number: '50,000+', stat1_label: '实验方案已生成',
  stat2_number: '200+',    stat2_label: '视频教程',
  stat3_number: '30,000+', stat3_label: '活跃科研人员',
  dk_title: '每日知识',
  dk_subtitle: '每天学习一点 ELISA 专业知识',
  dk_featured_tag1: '最新知识',
  dk_featured_tag2: '操作技巧',
  dk_featured_title: '实验重复性差？从这 3 个环节排查',
  dk_featured_desc: '系统性提升 ELISA 实验重复性的关键控制点。从加样操作到孵育条件，全面解析影响重复性的核心因素。',
  process_title: '平台使用流程',
  footer_copyright: '© 2025 Animal Union 爱萌优宁. All rights reserved.',
};

// ── MAIN PAGE ───────────────────────────────────────────────
export default function HomePage() {
  const [isEditMode, setIsEditMode] = useState(false);
  const [content, setContent] = useState(DEFAULT_CONTENT);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle');

  useEffect(() => {
    async function load() {
      // Try Supabase first
      const sb = initSupabase();
      if (sb) {
        try {
          const { data } = await sb.from('site_settings').select('homepage_content').eq('id', 1).single();
          if (data?.homepage_content) { setContent({ ...DEFAULT_CONTENT, ...data.homepage_content }); return; }
        } catch { /* fallback */ }
      }
      // Fallback to localStorage
      const local = loadFromLocal();
      if (local) setContent({ ...DEFAULT_CONTENT, ...local });
    }
    load();
  }, []);

  const handleUpdate = useCallback((key: string, value: string) => {
    setContent(prev => { const n = { ...prev }; n[key] = value; return n; });
    setHasChanges(true);
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    // Try Supabase first
    const sb = initSupabase();
    if (sb) {
      try {
        const { error } = await sb.from('site_settings').upsert({
          id: 1, homepage_content: content, updated_at: new Date().toISOString(),
        });
        if (!error) { setSaveStatus('saved'); setHasChanges(false); setTimeout(() => setSaveStatus('idle'), 2000); return; }
      } catch { /* fallback */ }
    }
    // Fallback to localStorage
    saveToLocal(content);
    setSaveStatus('saved');
    setHasChanges(false);
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const toggleEditMode = () => {
    if (isEditMode && hasChanges && !confirm('有未保存的更改，确定退出？')) return;
    setIsEditMode(!isEditMode);
  };

  return (
    <div className="min-h-screen bg-[#F2F6FA] text-[#1E293B] relative">
      {/* Edit Toggle */}
      <EditModeToggle isEditMode={isEditMode} onToggle={toggleEditMode} hasChanges={hasChanges} saveStatus={saveStatus} onSave={handleSave} />

      {/* ═══ NAVBAR ═══ */}
      <NavBar />

      {/* ═══ HERO ═══ */}
      <HeroSection content={content} isEditMode={isEditMode} onUpdate={handleUpdate} />

      {/* ═══ STATS ═══ */}
      <StatsBar content={content} isEditMode={isEditMode} onUpdate={handleUpdate} />

      {/* ═══ FEATURE CARDS ═══ */}
      <FeatureCards isEditMode={isEditMode} />

      {/* ═══ DATA ANALYSIS WORKBENCH ═══ */}
      <DataAnalysisWorkbench isEditMode={isEditMode} />

      {/* ═══ POINTS ECOSYSTEM ═══ */}
      <PointsEcosystem isEditMode={isEditMode} />

      {/* ═══ SMART PRODUCT SEARCH ═══ */}
      <SmartProductSearch isEditMode={isEditMode} />

      {/* ═══ PROCESS FLOW ═══ */}
      <ProcessFlow content={content} isEditMode={isEditMode} onUpdate={handleUpdate} />

      {/* ═══ VIDEO TUTORIALS ═══ */}
      <VideoTutorials isEditMode={isEditMode} />

      {/* ═══ ELISA METHODS ═══ */}
      <ElisaMethods isEditMode={isEditMode} />

      {/* ═══ DAILY KNOWLEDGE ═══ */}
      <DailyKnowledge content={content} isEditMode={isEditMode} onUpdate={handleUpdate} />

      {/* ═══ COMMUNITY ═══ */}
      <CommunitySection isEditMode={isEditMode} />

      {/* ═══ FOOTER ═══ */}
      <Footer content={content} isEditMode={isEditMode} onUpdate={handleUpdate} />
    </div>
  );
}

// ═══════════════════════════════════════════
// NAVBAR
// ═══════════════════════════════════════════
function NavBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-[#F2F6FA]/90 backdrop-blur-md border-b border-gray-200/60">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#3CB5C0] to-[#2563EB] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-[#3CB5C0] to-[#2563EB] bg-clip-text text-transparent">
            AIMENG UNING
          </span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-sm font-semibold text-blue-600">HOME</Link>
          <Link href="#analysis" className="text-sm text-[#475569] hover:text-blue-600 transition-colors">数据分析</Link>
          <Link href="#points" className="text-sm text-[#475569] hover:text-blue-600 transition-colors">积分系统</Link>
          <Link href="#search" className="text-sm text-[#475569] hover:text-blue-600 transition-colors">产品搜索</Link>
          <Link href="#videos" className="text-sm text-[#475569] hover:text-blue-600 transition-colors">视频教程</Link>
          <Link href="#knowledge" className="text-sm text-[#475569] hover:text-blue-600 transition-colors">每日分享</Link>
          <Link href="#community" className="text-sm text-[#475569] hover:text-blue-600 transition-colors">社区</Link>
        </div>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 rounded-full border border-[#cbd5e1] text-[#475569] text-sm font-medium hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all">
            登录
          </Link>
          <Link href="/register" className="px-4 py-2 rounded-full text-sm font-medium text-white" style={{background:'linear-gradient(90deg,#2563EB,#0891B2)'}}>
            注册
          </Link>
        </div>
      </div>
    </nav>
  );
}

// ═══════════════════════════════════════════
// HERO with Canvas Animation
// ═══════════════════════════════════════════
function HeroSection({ content, isEditMode, onUpdate }: any) {
  // Canvas animation effect
  useEffect(() => {
    const canvas = document.getElementById('bioCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let W: number, H: number, raf: number;
    let particles: any[] = [], cells: any[] = [], antibodies: any[] = [];
    let mitochondrias: any[] = [], viruses: any[] = [], bacterias: any[] = [];

    function resize() {
      const rect = canvas.parentElement?.getBoundingClientRect();
      W = canvas.width = rect?.width || window.innerWidth;
      H = canvas.height = rect?.height || 600;
    }
    resize();
    window.addEventListener('resize', resize);

    // Particles
    for (let i = 0; i < 50; i++) {
      particles.push({ x: Math.random() * 2000, y: Math.random() * 800, r: Math.random() * 2.5 + 1, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, alpha: Math.random() * 0.4 + 0.2 });
    }
    // Cells
    for (let i = 0; i < 8; i++) {
      cells.push({ x: Math.random() * 2000, y: Math.random() * 800, r: Math.random() * 35 + 30, vx: (Math.random() - 0.5) * 0.15, vy: (Math.random() - 0.5) * 0.15, nucleusR: Math.random() * 10 + 8, hue: Math.random() > 0.5 ? 210 : 185 });
    }
    // Antibodies
    for (let i = 0; i < 14; i++) {
      antibodies.push({ x: Math.random() * 2000, y: Math.random() * 800, size: Math.random() * 14 + 12, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, rot: Math.random() * 6.28, vRot: (Math.random() - 0.5) * 0.005 });
    }
    // Mitochondria
    for (let i = 0; i < 10; i++) {
      mitochondrias.push({ x: Math.random() * 2000, y: Math.random() * 800, w: Math.random() * 28 + 20, h: Math.random() * 14 + 12, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, rot: Math.random() * 6.28, vRot: (Math.random() - 0.5) * 0.003 });
    }
    // Virus
    for (let i = 0; i < 6; i++) {
      viruses.push({ x: Math.random() * 2000, y: Math.random() * 800, r: Math.random() * 12 + 10, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, spikes: Math.floor(Math.random() * 4) + 6 });
    }
    // Bacteria
    for (let i = 0; i < 8; i++) {
      bacterias.push({ x: Math.random() * 2000, y: Math.random() * 800, w: Math.random() * 20 + 15, h: Math.random() * 6 + 5, vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3, rot: Math.random() * 6.28, vRot: (Math.random() - 0.5) * 0.005 });
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      // Particles
      particles.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fillStyle = `rgba(37,99,235,${p.alpha})`; ctx.fill(); });
      // Bacteria
      bacterias.forEach(b => {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot);
        ctx.beginPath(); ctx.roundRect(-b.w / 2, -b.h / 2, b.w, b.h, b.h / 2);
        ctx.fillStyle = 'rgba(16,185,129,0.12)'; ctx.fill();
        ctx.strokeStyle = 'rgba(16,185,129,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.restore();
      });
      // Cells
      cells.forEach(c => {
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
        g.addColorStop(0, `hsla(${c.hue},80%,70%,0.3)`); g.addColorStop(0.5, `hsla(${c.hue},70%,60%,0.15)`); g.addColorStop(1, `hsla(${c.hue},60%,50%,0)`);
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 6.28); ctx.fillStyle = g as any; ctx.fill();
        ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 0.7, 0, 6.28); ctx.strokeStyle = `hsla(${c.hue},60%,60%,0.45)`; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(c.x, c.y, c.nucleusR, 0, 6.28); ctx.fillStyle = `hsla(${c.hue},50%,50%,0.35)`; ctx.fill();
        ctx.strokeStyle = `hsla(${c.hue},50%,45%,0.5)`; ctx.lineWidth = 1; ctx.stroke();
      });
      // Mitochondria
      mitochondrias.forEach(m => {
        ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(m.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, m.w / 2, m.h / 2, 0, 0, 6.28);
        ctx.strokeStyle = 'rgba(59,130,246,0.45)'; ctx.lineWidth = 1.8; ctx.stroke();
        ctx.fillStyle = 'rgba(59,130,246,0.08)'; ctx.fill();
        ctx.strokeStyle = 'rgba(59,130,246,0.3)'; ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-m.w * 0.25, i * m.h * 0.12); ctx.quadraticCurveTo(0, i * m.h * 0.12 + m.h * 0.1, m.w * 0.25, i * m.h * 0.12); ctx.stroke(); }
        ctx.restore();
      });
      // Virus
      viruses.forEach(v => {
        ctx.save(); ctx.translate(v.x, v.y); ctx.rotate(Date.now() * 0.0004);
        ctx.beginPath(); ctx.arc(0, 0, v.r * 0.5, 0, 6.28);
        ctx.fillStyle = 'rgba(168,85,247,0.15)'; ctx.fill();
        ctx.strokeStyle = 'rgba(168,85,247,0.45)'; ctx.lineWidth = 1.5; ctx.stroke();
        for (let i = 0; i < v.spikes; i++) {
          const a = (6.28 / v.spikes) * i;
          ctx.beginPath(); ctx.moveTo(Math.cos(a) * v.r * 0.45, Math.sin(a) * v.r * 0.45); ctx.lineTo(Math.cos(a) * v.r * 0.7, Math.sin(a) * v.r * 0.7); ctx.strokeStyle = 'rgba(168,85,247,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
          ctx.beginPath(); ctx.arc(Math.cos(a) * v.r * 0.7, Math.sin(a) * v.r * 0.7, 1.5, 0, 6.28); ctx.fillStyle = 'rgba(168,85,247,0.5)'; ctx.fill();
        }
        ctx.restore();
      });
      // Antibodies
      antibodies.forEach(a => {
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.rot);
        const s = a.size;
        ctx.strokeStyle = 'rgba(6,182,212,0.55)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, s * 0.5); ctx.lineTo(0, -s * 0.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -s * 0.2); ctx.lineTo(-s * 0.4, -s * 0.7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -s * 0.2); ctx.lineTo(s * 0.4, -s * 0.7); ctx.stroke();
        ctx.fillStyle = 'rgba(6,182,212,0.7)';
        ctx.beginPath(); ctx.arc(-s * 0.4, -s * 0.7, 2.5, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.4, -s * 0.7, 2.5, 0, 6.28); ctx.fill();
        ctx.beginPath(); ctx.arc(0, s * 0.5, 2.5, 0, 6.28); ctx.fill();
        ctx.restore();
      });
    }

    function update() {
      [...particles, ...cells, ...antibodies, ...mitochondrias, ...viruses, ...bacterias].forEach(e => {
        e.x += e.vx || 0; e.y += e.vy || 0;
        if (e.rot !== undefined) e.rot += e.vRot || 0;
        const margin = 60;
        if (e.x < -margin) e.x = W + margin; if (e.x > W + margin) e.x = -margin;
        if (e.y < -margin) e.y = H + margin; if (e.y > H + margin) e.y = -margin;
      });
    }

    function loop() { update(); draw(); raf = requestAnimationFrame(loop); }
    loop();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <section className="relative pt-32 pb-20 px-4 overflow-hidden">
      {/* Canvas background */}
      <canvas id="bioCanvas" className="absolute inset-0 w-full h-full" style={{ opacity: 0.65 }} />
      {/* White overlay for readability */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg,rgba(242,246,250,0.8) 0%,rgba(242,246,250,0.6) 40%,rgba(242,246,250,0.25) 100%)' }} />
      <div className="absolute top-20 right-0 w-96 h-96 bg-blue-100/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-72 h-72 bg-cyan-100/30 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="mb-6">
          <span className="text-blue-600 text-sm font-semibold tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full">
            <InlineEdit isEditMode={isEditMode} value={content.hero_tag} onChange={(v: string) => onUpdate('hero_tag', v)} />
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight">
          <InlineEdit isEditMode={isEditMode} value={content.hero_title} onChange={(v: string) => onUpdate('hero_title', v)} className="block text-[#1E293B]" />
          <InlineEdit isEditMode={isEditMode} value={content.hero_title_highlight} onChange={(v: string) => onUpdate('hero_title_highlight', v)} className="block bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 bg-clip-text text-transparent" />
        </h1>
        <div className="max-w-xl mb-8">
          <InlineEdit isEditMode={isEditMode} value={content.hero_subtitle} onChange={(v: string) => onUpdate('hero_subtitle', v)} className="text-[#64748B] text-lg leading-relaxed" multiline />
        </div>
        <div className="flex items-center gap-4 mb-10">
          <Link href="/ai-chat" className="px-8 py-3 rounded-full text-white font-medium hover:shadow-lg transition-all flex items-center gap-2" style={{ background: 'linear-gradient(90deg,#2563EB,#0891B2)' }}>
            <InlineEdit isEditMode={isEditMode} value={content.hero_button1} onChange={(v: string) => onUpdate('hero_button1', v)} />
          </Link>
          <Link href="#videos" className="px-8 py-3 rounded-full border border-[#cbd5e1] text-[#475569] font-medium hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center gap-2">
            <Video className="w-4 h-4 text-blue-500" />
            <InlineEdit isEditMode={isEditMode} value={content.hero_button2} onChange={(v: string) => onUpdate('hero_button2', v)} />
          </Link>
        </div>
        <div className="flex items-center gap-8 pt-6 border-t border-gray-200/60">
          <div><p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">50,000+</p><p className="text-[#94A3B8] text-sm">实验方案已生成</p></div>
          <div className="w-px h-10 bg-gray-200" />
          <div><p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">200+</p><p className="text-[#94A3B8] text-sm">视频教程</p></div>
          <div className="w-px h-10 bg-gray-200" />
          <div><p className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">30,000+</p><p className="text-[#94A3B8] text-sm">活跃科研人员</p></div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// STATS BAR
// ═══════════════════════════════════════════
function StatsBar({ content, isEditMode, onUpdate }: any) {
  return (
    <section className="py-8 px-4 border-y border-gray-200/40 bg-white/60 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
        {[
          { key: 'stat1', n: content.stat1_number, l: content.stat1_label },
          { key: 'stat2', n: content.stat2_number, l: content.stat2_label },
          { key: 'stat3', n: content.stat3_number, l: content.stat3_label },
          { key: 'stat4', n: '24h', l: 'AI在线响应' },
        ].map(s => (
          <div key={s.key} className="text-center">
            <InlineEdit isEditMode={isEditMode} value={s.n} onChange={(v: string) => onUpdate(s.key + '_number', v)} className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent block mb-1" />
            <InlineEdit isEditMode={isEditMode} value={s.l} onChange={(v: string) => onUpdate(s.key + '_label', v)} className="text-[#94A3B8] text-sm" />
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// FEATURE CARDS (8 cards)
// ═══════════════════════════════════════════
function FeatureCards({ isEditMode }: { isEditMode: boolean }) {
  const cards = [
    { icon: FlaskConical, title: '实验方案设计', desc: 'AI根据您的实验需求，智能生成最优ELISA实验方案', color: 'from-blue-500 to-cyan-400', link: '/ai-chat' },
    { icon: Video, title: '操作视频教程', desc: '详细的实验操作视频，从准备到结果分析全流程指导', color: 'from-purple-500 to-pink-400', link: '#videos' },
    { icon: MessageCircle, title: 'AI智能客服', desc: '7x24小时在线解答，DeepSeek大模型专业回复', color: 'from-emerald-500 to-teal-400', link: '/ai-chat' },
    { icon: FileBarChart, title: '实验报告生成', desc: '4PL拟合、标准曲线绘制、一键生成报告', color: 'from-amber-500 to-orange-400', link: '/ai-chat' },
    { icon: BookOpen, title: '文献积分系统', desc: '发表文献即可兑换积分，积分可兑换商城礼品', color: 'from-rose-500 to-red-400', link: '/points' },
    { icon: Gift, title: '积分商城', desc: '丰富科研周边礼品，积分免费兑换', color: 'from-indigo-500 to-violet-400', link: '/points' },
    { icon: Search, title: '产品搜索', desc: '快速搜索ELISA试剂盒，按靶标、种属、应用筛选', color: 'from-sky-500 to-blue-400', link: '/products' },
    { icon: Globe, title: '科研社区', desc: '加入科研社区，与同行交流实验经验和心得', color: 'from-violet-500 to-purple-400', link: '#community' },
  ];
  return (
    <section className="py-16 px-4 bg-[#EDF2F7]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#1E293B] mb-2">核心功能</h2>
          <p className="text-[#94A3B8]">全方位的科研服务平台，助力您的每一个实验</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((c, i) => {
            const Icon = c.icon;
            return (
              <Link key={i} href={c.link} className="group bg-white rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-500/5 block relative" style={{ border: '1px solid #E2E8F0' }}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-4`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-[#1E293B] mb-2">{c.title}</h3>
                <p className="text-[#94A3B8] text-sm leading-relaxed">{c.desc}</p>
                <ArrowRight className="w-4 h-4 text-blue-400 absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// DATA ANALYSIS WORKBENCH (4PL + Curve)
// ═══════════════════════════════════════════
function DataAnalysisWorkbench({ isEditMode }: { isEditMode: boolean }) {
  return (
    <section id="analysis" className="py-20 px-4 bg-[#F2F6FA]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-blue-600 text-sm font-semibold tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full">DATA ANALYSIS WORKBENCH</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1E293B] mt-4 mb-4">实验数据分析工作台</h2>
          <p className="text-[#94A3B8] max-w-2xl mx-auto">从原始OD值到专业实验报告，一站式完成4PL拟合、标准曲线绘制和报告生成</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-400 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div><h3 className="text-[#1E293B] font-semibold">4PL 拟合 & 标准曲线</h3><p className="text-[#94A3B8] text-xs">四参数Logistic回归，R&sup2; &gt; 0.99</p></div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-medium border border-emerald-200">在线工具</span>
              </div>
              {/* SVG Curve */}
              <div className="bg-[#F6F8FB] rounded-xl p-4 border border-gray-100">
                <svg viewBox="0 0 600 200" className="w-full h-auto">
                  <defs><pattern id="grid" width="50" height="25" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 25" fill="none" stroke="#E2E8F0" strokeWidth="1"/></pattern>
                  <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stopColor="#3b82f6"/><stop offset="100%" stopColor="#22d3ee"/></linearGradient></defs>
                  <rect width="600" height="200" fill="url(#grid)"/>
                  <line x1="50" y1="170" x2="580" y2="170" stroke="#94a3b8" strokeWidth="1"/>
                  <line x1="50" y1="170" x2="50" y2="20" stroke="#94a3b8" strokeWidth="1"/>
                  <path d="M 50 160 Q 80 155 120 140 Q 180 110 250 80 Q 350 40 450 25 Q 520 18 580 15" fill="none" stroke="url(#cg)" strokeWidth="3" strokeLinecap="round"/>
                  {[{x:55,y:162,l:'S1'},{x:100,y:152,l:'S2'},{x:170,y:130,l:'S3'},{x:260,y:95,l:'S4'},{x:370,y:55,l:'S5'},{x:470,y:30,l:'S6'},{x:550,y:20,l:'S7'}].map(p => (
                    <g key={p.l}><circle cx={p.x} cy={p.y} r="6" fill="#22d3ee" stroke="white" strokeWidth="2"/><text x={p.x} y={p.y - 12} textAnchor="middle" fill="#64748b" fontSize="10">{p.l}</text></g>
                  ))}
                  <circle cx="320" cy="72" r="7" fill="#f59e0b" stroke="white" strokeWidth="2"/>
                  <text x="320" y="58" textAnchor="middle" fill="#f59e0b" fontSize="10" fontWeight="bold">Unknown</text>
                  <text x="580" y="188" textAnchor="end" fill="#94a3b8" fontSize="11">Concentration (pg/mL)</text>
                  <text x="20" y="15" textAnchor="middle" fill="#94a3b8" fontSize="11" transform="rotate(-90 20 100)">OD450</text>
                  <rect x="460" y="5" width="80" height="24" rx="6" fill="#d1fae5" stroke="#a7f3d0"/>
                  <text x="500" y="20" textAnchor="middle" fill="#059669" fontSize="11" fontWeight="bold">R&sup2; = 0.9987</text>
                </svg>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[{icon:Calculator,label:'4PL拟合',desc:'四参数Logistic'},{icon:LineChart,label:'标准曲线',desc:'7点自动拟合'},{icon:Sigma,label:'浓度计算',desc:'自动回算浓度'}].map((f,i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <f.icon className="w-4 h-4 text-blue-500" />
                    <div><div className="text-[#1E293B] text-xs font-medium">{f.label}</div><div className="text-[#94A3B8] text-xs">{f.desc}</div></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-pink-400 flex items-center justify-center"><FileSpreadsheet className="w-5 h-5 text-white" /></div>
                  <div><h3 className="text-[#1E293B] font-semibold">实验报告自动生成</h3><p className="text-[#94A3B8] text-xs">一键生成专业PDF实验报告</p></div>
                </div>
                <Link href="/ai-chat" className="px-4 py-2 rounded-lg text-white text-sm font-medium hover:shadow-lg transition-all" style={{background:'linear-gradient(90deg,#2563EB,#0891B2)'}}>开始分析</Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {['实验信息','标准曲线','样本浓度','PDF报告'].map((item,i) => (
                  <div key={i} className="bg-[#F6F8FB] rounded-lg p-3 text-center border border-gray-100">
                    <div className={`w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center ${i < 3 ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                      {i < 3 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <FileSpreadsheet className="w-4 h-4 text-blue-600" />}
                    </div>
                    <p className="text-[#1E293B] text-xs font-medium">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right - Flow */}
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl p-6 h-full" style={{ border: '1px solid #E2E8F0' }}>
              <h3 className="text-[#1E293B] font-semibold mb-6">分析流程</h3>
              <div className="space-y-3">
                {[{step:'01',title:'输入OD值',desc:'将酶标仪读取的各孔OD值粘贴输入',icon:BarChart3},{step:'02',title:'4PL自动拟合',desc:'系统使用四参数Logistic回归自动拟合标准曲线',icon:TrendingUp},{step:'03',title:'浓度回算',desc:'根据标准曲线自动计算未知样本浓度',icon:Calculator},{step:'04',title:'生成报告',desc:'一键生成包含曲线图、数据表的专业PDF报告',icon:FileSpreadsheet}].map((s,i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className="flex items-start gap-4 p-4 rounded-xl bg-[#F6F8FB] border border-gray-100">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0"><Icon className="w-5 h-5" /></div>
                      <div><div className="flex items-center gap-2 mb-1"><span className="text-blue-600 text-xs font-mono">{s.step}</span><h4 className="text-[#1E293B] font-medium text-sm">{s.title}</h4></div><p className="text-[#94A3B8] text-xs leading-relaxed">{s.desc}</p></div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-100">
                <p className="text-blue-700 text-sm font-medium mb-2">支持功能</p>
                <div className="flex flex-wrap gap-2">
                  {['4PL拟合','线性拟合','复孔CV计算','浓度稀释换算','OD值质控','PDF导出'].map(tag => (
                    <span key={tag} className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// POINTS ECOSYSTEM
// ═══════════════════════════════════════════
function PointsEcosystem({ isEditMode }: { isEditMode: boolean }) {
  const steps = [
    { icon: FileBarChart, title: '发表文献', desc: '使用我们的产品发表科研论文', color: 'from-blue-500 to-cyan-400', points: '+100~500', status: '积分' },
    { icon: CheckCircle, title: '提交审核', desc: '上传论文信息等待审核', color: 'from-emerald-500 to-teal-400', points: '审核中', status: '审核' },
    { icon: Coins, title: '获得积分', desc: '审核通过后自动发放积分', color: 'from-amber-500 to-orange-400', points: '已到账', status: '到账' },
    { icon: Gift, title: '兑换礼品', desc: '积分兑换科研周边好礼', color: 'from-rose-500 to-pink-400', points: '可兑换', status: '兑换' },
  ];
  const rewards = [
    { name: 'ELISA试剂盒折扣券', points: 500, icon: FlaskConical, hot: true },
    { name: '定制实验记录本', points: 300, icon: BookOpen, hot: false },
    { name: '品牌离心管套装', points: 200, icon: Microscope, hot: false },
    { name: '科研马克杯', points: 150, icon: Gift, hot: true },
  ];
  return (
    <section id="points" className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-blue-600 text-sm font-semibold tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full">POINTS ECOSYSTEM</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1E293B] mt-4 mb-4">积分生态系统</h2>
          <p className="text-[#94A3B8] max-w-2xl mx-auto">发表论文即可获得积分奖励，积分可在商城兑换丰富科研周边礼品</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {steps.map((s, i) => { const Icon = s.icon; return (
            <div key={i} className="relative">
              <div className="bg-white rounded-2xl p-6 transition-all hover:-translate-y-1" style={{ border: '1px solid #E2E8F0' }}>
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-4`}><Icon className="w-6 h-6" /></div>
                <h3 className="text-[#1E293B] font-semibold mb-2">{s.title}</h3>
                <p className="text-[#94A3B8] text-sm mb-3">{s.desc}</p>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${s.status === '积分' ? 'bg-amber-50 text-amber-600 border border-amber-200' : s.status === '审核' ? 'bg-blue-50 text-blue-600 border border-blue-200' : s.status === '到账' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}>
                  <Coins className="w-3 h-3" />{s.points}
                </span>
              </div>
              {i < 3 && <div className="hidden lg:flex absolute top-1/2 -right-3 transform -translate-y-1/2 z-10"><ChevronRight className="w-6 h-6 text-gray-300" /></div>}
            </div>
          ); })}
        </div>
        <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3"><ShoppingBag className="w-6 h-6 text-blue-500" /><h3 className="text-[#1E293B] font-semibold">积分商城精选</h3></div>
            <Link href="/points" className="text-blue-500 text-sm hover:text-blue-600 flex items-center gap-1">查看全部 <ChevronRight className="w-4 h-4" /></Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {rewards.map((r, i) => { const Icon = r.icon; return (
              <div key={i} className="bg-[#F6F8FB] rounded-xl p-4 border border-gray-100 hover:border-blue-200 transition-all group">
                <div className="flex items-center justify-between mb-3"><div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600"><Icon className="w-5 h-5" /></div>
                {r.hot && <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white shadow-sm" style={{background:'linear-gradient(135deg,#f59e0b,#d97706)'}}>HOT</span>}</div>
                <h4 className="text-[#1E293B] text-sm font-medium mb-2">{r.name}</h4>
                <div className="flex items-center gap-1 text-amber-500"><Coins className="w-4 h-4" /><span className="font-semibold text-sm">{r.points}</span><span className="text-[#94A3B8] text-xs">积分</span></div>
              </div>
            ); })}
          </div>
          <div className="mt-6 flex items-center justify-center gap-4">
            <Link href="/points" className="px-6 py-3 rounded-full text-white font-medium hover:shadow-lg transition-all flex items-center gap-2" style={{background:'linear-gradient(90deg,#2563EB,#0891B2)'}}><Award className="w-4 h-4" />提交论文获取积分</Link>
            <Link href="/points" className="px-6 py-3 rounded-full border border-[#cbd5e1] text-[#475569] font-medium hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center gap-2"><ShoppingBag className="w-4 h-4" />浏览积分商城</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// SMART PRODUCT SEARCH
// ═══════════════════════════════════════════
function SmartProductSearch({ isEditMode }: { isEditMode: boolean }) {
  const species = [
    { name: '人', latin: 'Human', icon: 'fa-user', count: '1,200+' },
    { name: '小鼠', latin: 'Mouse', icon: 'fa-mouse', count: '980+' },
    { name: '大鼠', latin: 'Rat', icon: 'fa-paw', count: '850+' },
    { name: '猴', latin: 'Monkey', icon: 'fa-paw', count: '420+' },
    { name: '狗', latin: 'Dog', icon: 'fa-dog', count: '380+' },
    { name: '猪', latin: 'Pig', icon: 'fa-hamburger', count: '350+' },
    { name: '牛', latin: 'Bovine', icon: 'fa-cheese', count: '280+' },
    { name: '鸡', latin: 'Chicken', icon: 'fa-kiwi-bird', count: '260+' },
  ];
  const greekLetters = ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'π', 'σ', 'ω', 'Δ'];
  const hotTags = ['IL-6', 'TNF-α', 'IFN-γ', 'IL-10', 'VEGF', 'IL-1β', 'CRP', 'IgG'];
  return (
    <section id="search" className="py-20 px-4 bg-[#EDF2F7]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-blue-600 text-sm font-semibold tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full">SMART PRODUCT SEARCH</span>
          <h2 className="text-3xl md:text-4xl font-bold text-[#1E293B] mt-4 mb-4">智能产品搜索</h2>
          <p className="text-[#94A3B8] max-w-2xl mx-auto">支持按种属、靶标、希腊字母等多种方式快速找到所需的ELISA试剂盒</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
              <div className="relative mb-6">
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#F6F8FB] border border-gray-200">
                  <Search className="w-5 h-5 text-[#94A3B8]" />
                  <span className="text-[#94A3B8] text-sm">IL-6、TNF-α、IFN-γ...</span>
                  <span className="ml-auto px-3 py-1 rounded bg-blue-100 text-blue-600 text-xs font-medium">搜索</span>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-[#94A3B8] text-xs mb-3 flex items-center gap-2"><Sigma className="w-4 h-4 text-blue-500" />希腊字母快速选择</p>
                <div className="flex flex-wrap gap-2">
                  {greekLetters.map(l => <span key={l} className="w-10 h-10 rounded-lg bg-[#F6F8FB] border border-gray-200 flex items-center justify-center text-[#475569] font-medium hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all cursor-pointer">{l}</span>)}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-[#F6F8FB] border border-gray-100"><p className="text-2xl font-bold text-blue-600">3,484+</p><p className="text-[#94A3B8] text-xs">产品总数</p></div>
                <div className="text-center p-3 rounded-lg bg-[#F6F8FB] border border-gray-100"><p className="text-2xl font-bold text-emerald-600">20+</p><p className="text-[#94A3B8] text-xs">覆盖种属</p></div>
                <div className="text-center p-3 rounded-lg bg-[#F6F8FB] border border-gray-100"><p className="text-2xl font-bold text-amber-600">50+</p><p className="text-[#94A3B8] text-xs">应用领域</p></div>
              </div>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[#1E293B] font-semibold flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500" />按种属筛选</h3>
                <Link href="/products" className="text-blue-500 text-sm hover:text-blue-600 flex items-center gap-1">查看全部 <ChevronRight className="w-4 h-4" /></Link>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {species.map((s, i) => (
                  <Link key={i} href="/products" className="group p-4 rounded-xl bg-[#F6F8FB] border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-all text-center">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 text-xl group-hover:scale-110 transition-transform">
                      <i className={`fas ${s.icon}`} />
                    </div>
                    <h4 className="text-[#1E293B] text-sm font-medium mb-1">{s.name}</h4>
                    <p className="text-[#94A3B8] text-xs mb-2">{s.latin}</p>
                    <span className="text-blue-600 text-xs font-medium">{s.count} 产品</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <span className="text-[#94A3B8] text-sm mr-2">热门搜索：</span>
          {hotTags.map(t => <Link key={t} href="/products" className="px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[#475569] text-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all">{t}</Link>)}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// PROCESS FLOW
// ═══════════════════════════════════════════
function ProcessFlow({ content, isEditMode, onUpdate }: any) {
  const steps = [
    { num: '01', title: '查询产品', desc: '搜索所需ELISA试剂盒' },
    { num: '02', title: '访问网站', desc: '获取产品详细信息' },
    { num: '03', title: '学习实验', desc: '观看视频教程' },
    { num: '04', title: 'AI辅助', desc: 'AI助手全程指导' },
    { num: '05', title: '完成实验', desc: '获得实验结果' },
    { num: '06', title: '获得奖励', desc: '积分兑换礼品' },
  ];
  return (
    <section className="py-20 px-4 bg-[#EDF2F7]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <InlineEdit isEditMode={isEditMode} value={content.process_title} onChange={(v: string) => onUpdate('process_title', v)} className="text-3xl font-bold text-[#1E293B] block mb-2" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 mt-12">
          {steps.map((s, i) => (
            <div key={i} className="relative text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                <span className="text-2xl font-bold text-blue-600">{s.num}</span>
              </div>
              <h4 className="text-[#1E293B] font-medium mb-1">{s.title}</h4>
              <p className="text-[#94A3B8] text-xs">{s.desc}</p>
              {i < 5 && <div className="hidden lg:block absolute top-8 -right-3 text-gray-300"><ChevronRight className="w-5 h-5" /></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// VIDEO TUTORIALS
// ═══════════════════════════════════════════
function VideoTutorials({ isEditMode }: { isEditMode: boolean }) {
  const videos = [
    { title: 'ELISA实验基础操作', duration: '15:30', views: '2.3k', bg: 'from-blue-100 to-cyan-100' },
    { title: '双抗夹心法详解', duration: '22:15', views: '1.8k', bg: 'from-purple-100 to-pink-100' },
    { title: '实验数据分析入门', duration: '18:45', views: '3.1k', bg: 'from-emerald-100 to-teal-100' },
  ];
  return (
    <section id="videos" className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-blue-600 text-sm font-semibold tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full">VIDEO TUTORIALS</span>
          <h2 className="text-3xl font-bold text-[#1E293B] mt-4">实验操作视频教程</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {videos.map((v, i) => (
            <a key={i} href="https://www.xiaohongshu.com/" target="_blank" className="group bg-white rounded-2xl overflow-hidden transition-all hover:-translate-y-1 block" style={{ border: '1px solid #E2E8F0' }}>
              <div className={`aspect-video bg-gradient-to-br ${v.bg} flex items-center justify-center relative`}>
                <div className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video className="w-6 h-6 text-blue-500" />
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white">{v.duration}</div>
                <div className="absolute top-2 left-2 px-2 py-1 rounded bg-red-500 text-xs text-white flex items-center gap-1"><i className="fas fa-external-link-alt text-xs" />小红书</div>
              </div>
              <div className="p-4">
                <h4 className="text-[#1E293B] font-medium mb-2">{v.title}</h4>
                <div className="flex items-center gap-2 text-[#94A3B8] text-xs"><Users className="w-3 h-3" /><span>{v.views} views</span></div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// ELISA METHODS
// ═══════════════════════════════════════════
function ElisaMethods({ isEditMode }: { isEditMode: boolean }) {
  const methods = [
    { name: '双抗夹心法', en: 'Sandwich ELISA', desc: '最常用方法，灵敏度高，特异性强', icon: Microscope },
    { name: '竞争法', en: 'Competitive ELISA', desc: '适用于小分子检测', icon: FlaskConical },
    { name: '直接法', en: 'Direct ELISA', desc: '操作简便，快速检测', icon: Zap },
    { name: '间接法', en: 'Indirect ELISA', desc: '信号放大，灵敏度更高', icon: ExternalLink },
  ];
  return (
    <section className="py-20 px-4 bg-[#EDF2F7]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-[#1E293B] mb-2">ELISA技术方案</h2>
          <p className="text-[#94A3B8]">四种经典检测方法</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {methods.map((m, i) => { const Icon = m.icon; return (
            <div key={i} className="bg-white rounded-2xl p-6 text-center transition-all hover:-translate-y-1 group" style={{ border: '1px solid #E2E8F0' }}>
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Icon className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-[#1E293B] font-semibold mb-1">{m.name}</h4>
              <p className="text-blue-600 text-sm mb-2">{m.en}</p>
              <p className="text-[#94A3B8] text-xs">{m.desc}</p>
            </div>
          ); })}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// DAILY KNOWLEDGE (with InlineEdit)
// ═══════════════════════════════════════════
function DailyKnowledge({ content, isEditMode, onUpdate }: any) {
  const items = [
    { date: '2026-05-27', tag: '产品指南', title: 'ELISA 试剂盒保存与复溶注意事项' },
    { date: '2026-05-26', tag: '产品指南', title: '新品推荐：高灵敏度 IL-6 试剂盒' },
    { date: '2026-05-25', tag: '实验技巧', title: 'TMB 显色液配制与避光操作要点' },
  ];
  return (
    <section id="knowledge" className="py-20 px-4 bg-[#F2F6FA]">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-4xl font-bold text-[#1E293B] mb-2">
              <InlineEdit isEditMode={isEditMode} value={content.dk_title} onChange={(v: string) => onUpdate('dk_title', v)} />
            </h2>
            <p className="text-[#94A3B8] text-lg">
              <InlineEdit isEditMode={isEditMode} value={content.dk_subtitle} onChange={(v: string) => onUpdate('dk_subtitle', v)} />
            </p>
          </div>
          <Link href="/knowledge" className="text-blue-600 text-sm font-medium hover:text-blue-700 flex items-center gap-1">查看全部 <ChevronRight className="w-4 h-4" /></Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Featured */}
          <div className="lg:col-span-3 bg-white rounded-2xl p-8 transition-all hover:-translate-y-1" style={{ border: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-xs font-semibold border border-emerald-200 flex items-center gap-1"><Zap className="w-3 h-3" />最新知识</span>
              <span className="px-3 py-1 rounded-full bg-[#F6F8FB] text-[#94A3B8] text-xs border border-gray-200">
                <InlineEdit isEditMode={isEditMode} value={content.dk_featured_tag2} onChange={(v: string) => onUpdate('dk_featured_tag2', v)} />
              </span>
            </div>
            <h3 className="text-2xl font-bold text-[#1E293B] mb-4 leading-snug">
              <InlineEdit isEditMode={isEditMode} value={content.dk_featured_title} onChange={(v: string) => onUpdate('dk_featured_title', v)} />
            </h3>
            <p className="text-[#94A3B8] leading-relaxed mb-6">
              <InlineEdit isEditMode={isEditMode} value={content.dk_featured_desc} onChange={(v: string) => onUpdate('dk_featured_desc', v)} multiline />
            </p>
            <div className="flex flex-wrap gap-2">
              {['重复性', '质量控制', '标准化'].map(t => <span key={t} className="px-3 py-1 rounded-full bg-[#F6F8FB] text-[#94A3B8] text-xs border border-gray-100">{t}</span>)}
            </div>
          </div>

          {/* List */}
          <div className="lg:col-span-2 space-y-4">
            {items.map((item, i) => (
              <div key={i} className="bg-white rounded-xl p-5 cursor-pointer transition-all hover:bg-[#F6F8FB]" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[#94A3B8] text-sm">{item.date}</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-xs border border-blue-100">{item.tag}</span>
                </div>
                <h4 className="text-[#1E293B] font-semibold text-base leading-snug">{item.title}</h4>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// COMMUNITY
// ═══════════════════════════════════════════
function CommunitySection({ isEditMode }: { isEditMode: boolean }) {
  const discussions = [
    { name: '张博士', initial: 'Z', tag: '实验方案', tagColor: 'blue', title: '小鼠IL-6检测实验方案优化讨论', replies: 23, time: '2小时前' },
    { name: '李研究员', initial: 'L', tag: '技术交流', tagColor: 'blue', title: '双抗夹心法标准曲线构建经验分享', replies: 45, time: '5小时前' },
    { name: '王教授', initial: 'W', tag: '常见问题', tagColor: 'amber', title: 'ELISA实验常见问题汇总与解决方案', replies: 89, time: '1天前' },
  ];
  return (
    <section id="community" className="py-20 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-blue-600 text-sm font-semibold tracking-widest uppercase bg-blue-50 px-3 py-1 rounded-full">COMMUNITY</span>
          <h2 className="text-3xl font-bold text-[#1E293B] mt-4 mb-4">科研社区</h2>
          <p className="text-[#94A3B8] max-w-2xl mx-auto">加入爱萌优宁科研社区，与全国科研人员交流ELISA实验经验，分享技术心得，解决实验难题</p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-2xl p-6" style={{ border: '1px solid #E2E8F0' }}>
              <h4 className="text-[#1E293B] font-semibold mb-4">社区数据</h4>
              <div className="space-y-4">
                {[{label:'社区成员',val:'12,580+',c:'text-blue-600'},{label:'讨论话题',val:'3,420+',c:'text-blue-600'},{label:'今日活跃',val:'286',c:'text-emerald-600'},{label:'专家解答',val:'98.5%',c:'text-amber-600'}].map(s => (
                  <div key={s.label} className="flex items-center justify-between"><span className="text-[#94A3B8] text-sm">{s.label}</span><span className={`${s.c} font-bold`}>{s.val}</span></div>
                ))}
              </div>
            </div>
            <Link href="#" className="block w-full py-3 rounded-xl text-center text-white font-medium hover:shadow-lg transition-all" style={{background:'linear-gradient(90deg,#2563EB,#0891B2)'}}>加入社区讨论</Link>
          </div>
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-[#1E293B] font-semibold mb-4">热门讨论</h4>
            {discussions.map((d, i) => (
              <div key={i} className="bg-white rounded-xl p-4 hover:bg-[#F6F8FB] transition-all cursor-pointer" style={{ border: '1px solid #E2E8F0' }}>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-semibold">{d.initial}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1"><span className="text-blue-600 text-sm font-medium">{d.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs border ${d.tagColor === 'amber' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>{d.tag}</span>
                    </div>
                    <h5 className="text-[#1E293B] font-medium mb-2">{d.title}</h5>
                    <div className="flex items-center gap-4 text-[#94A3B8] text-xs"><span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{d.replies} 回复</span><span>{d.time}</span></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════
// FOOTER
// ═══════════════════════════════════════════
function Footer({ content, isEditMode, onUpdate }: any) {
  return (
    <footer className="bg-[#0b1120] text-white py-16 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg,#3CB5C0,#2563EB)'}}>
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-lg font-bold text-white">AIMENG UNING</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              AI-powered biotech platform integrating DeepSeek large language models with laboratory experiment workflows.
            </p>
            <div className="flex items-center gap-3">
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all"><i className="fab fa-weixin" /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all"><i className="fab fa-telegram" /></a>
              <a href="#" className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-blue-600 hover:text-white transition-all"><i className="fas fa-envelope" /></a>
            </div>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-5">Quick Links</h4>
            <ul className="space-y-3">
              {['AI Lab','Video Library','AI Assistant','Report Generator','Points Mall'].map(l => (
                <li key={l}><Link href="#" className="text-slate-400 text-sm hover:text-blue-400 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-5">Resources</h4>
            <ul className="space-y-3">
              {['Daily Tips','Literature Hub','Community','Help Center'].map(l => (
                <li key={l}><Link href="#" className="text-slate-400 text-sm hover:text-blue-400 transition-colors">{l}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm tracking-wider uppercase mb-5">Connect</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3 text-slate-400 text-sm"><i className="fas fa-envelope text-blue-400" /><span>support@aimenguning.com</span></li>
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
