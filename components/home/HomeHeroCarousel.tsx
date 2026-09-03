'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { HomeBanner } from '@/lib/home-banners'

const fallbackBanners: HomeBanner[] = [
  {
    id: 'fallback-1-ai',
    title: '更少搜索，更快速进展',
    subtitle: '爱萌AI助手即刻开启',
    eyebrow: 'AI ASSISTANT',
    description: '从实验方案、产品推荐到数据分析，爱萌优宁AI助手帮助科研人员更快完成每一个关键步骤。',
    cta_label: '开始体验',
    cta_href: '/chat?mode=protocol',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'blue',
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'fallback-2-promo',
    title: '重点产品限时活动',
    subtitle: 'ELISA 试剂盒精选推荐',
    eyebrow: 'PROMOTION',
    description: '适合新品发布、节日活动和重点指标推广。后台上传活动海报后，会在右侧大图区域轮播展示。',
    cta_label: '了解更多',
    cta_href: '/products/elisa',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'amber',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'fallback-3-analysis',
    title: 'ELISA Calc 功能升级',
    subtitle: '从OD值到报告一站完成',
    eyebrow: 'DATA ANALYSIS',
    description: '导入实验数据后完成标准曲线绘制、4PL拟合、样本浓度计算，并生成规范实验报告。',
    cta_label: '进入数据分析',
    cta_href: '/lab/analysis',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'emerald',
    sort_order: 3,
    is_active: true,
  },
  {
    id: 'fallback-4-fbs',
    title: '胎牛血清产品展示',
    subtitle: '高品质细胞培养支持',
    eyebrow: 'FBS SHOWCASE',
    description: '用于展示标准胎牛血清、特殊工艺血清及细胞测试数据，客户可快速进入产品内页了解详情。',
    cta_label: '查看胎牛血清',
    cta_href: '/products/fbs',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'rose',
    sort_order: 4,
    is_active: true,
  },
  {
    id: 'fallback-5-coa',
    title: 'COA 查询系统',
    subtitle: '批次文件快速获取',
    eyebrow: 'COA LOOKUP',
    description: '血清产品可按货号和批号查询 COA 文件，便于客户保存质控资料和追溯生产批次。',
    cta_label: '进入COA查询',
    cta_href: '/products/coa',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'blue',
    sort_order: 5,
    is_active: true,
  },
  {
    id: 'fallback-6-points',
    title: '文献引用积分活动',
    subtitle: '论文成果兑换奖励',
    eyebrow: 'POINTS CAMPAIGN',
    description: '客户提交使用爱萌产品发表的文献，审核通过后获得积分，可在积分商城兑换科研礼品。',
    cta_label: '提交文献',
    cta_href: '/user/citations/submit',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'amber',
    sort_order: 6,
    is_active: true,
  },
  {
    id: 'fallback-7-community',
    title: '科研社区上线',
    subtitle: '讨论实验问题与经验',
    eyebrow: 'COMMUNITY',
    description: '客户可以围绕实验设计、操作问题和数据分析进行交流，沉淀常见问题与解决方案。',
    cta_label: '进入科研社区',
    cta_href: '/community',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'emerald',
    sort_order: 7,
    is_active: true,
  },
  {
    id: 'fallback-8-daily',
    title: '每日知识更新',
    subtitle: '每天一点ELISA经验',
    eyebrow: 'DAILY KNOWLEDGE',
    description: '围绕ELISA原理、样本处理、数据分析和常见问题，持续更新可读、可用的实验知识。',
    cta_label: '查看每日知识',
    cta_href: '/knowledge',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'blue',
    sort_order: 8,
    is_active: true,
  },
  {
    id: 'fallback-9-holiday',
    title: '节日祝福与活动公告',
    subtitle: '品牌动态集中展示',
    eyebrow: 'BRAND NEWS',
    description: '节日海报、展会通知、促销活动和公司公告，都可以在这里以大图轮播形式展示。',
    cta_label: '联系我们',
    cta_href: '/contact',
    secondary_label: '',
    secondary_href: '#',
    image_url: '',
    theme: 'rose',
    sort_order: 9,
    is_active: true,
  },
]

const themeColor: Record<HomeBanner['theme'], string> = {
  blue: '#2f8d99',
  emerald: '#16866f',
  amber: '#d97706',
  rose: '#be426d',
}

function BannerPoster({ banner, imageFit = 'cover' }: { banner: HomeBanner; imageFit?: 'cover' | 'contain' }) {
  const color = themeColor[banner.theme] || themeColor.blue

  if (banner.image_url) {
    return (
      <div className="relative h-full w-full">
        <Image
          src={banner.image_url}
          alt={banner.title}
          fill
          sizes="(max-width: 768px) 100vw, 46vw"
          className={imageFit === 'cover' ? 'object-cover' : 'object-contain'}
        />
      </div>
    )
  }

  return (
    <div
      className="grid h-full w-full place-items-center overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color} 0%, #111827 100%)` }}
    >
      <div className="relative h-full w-full p-10 text-white">
        <div className="absolute right-8 top-8 rounded-full border border-white/30 px-4 py-2 text-xs font-semibold">
          AIMENG UNING
        </div>
        <div className="absolute left-8 top-9 text-xs font-semibold uppercase tracking-widest text-white/70">
          {banner.eyebrow}
        </div>
        <div className="flex h-full flex-col justify-center">
          <p className="text-3xl font-black leading-tight md:text-4xl">{banner.subtitle}</p>
          <p className="mt-4 max-w-xl text-xl font-semibold leading-tight">{banner.title}</p>
        </div>
        <div className="absolute bottom-8 left-8 h-1 w-20 rounded-full bg-white/70" />
      </div>
    </div>
  )
}

export default function HomeHeroCarousel({
  banners = fallbackBanners,
  variant = 'section',
}: {
  banners?: HomeBanner[]
  variant?: 'section' | 'hero'
}) {
  const [remoteBanners, setRemoteBanners] = useState<HomeBanner[] | null>(null)
  const activeBanners = useMemo(() => {
    const source = remoteBanners?.length ? remoteBanners : banners.length ? banners : fallbackBanners
    return source.filter((item) => item.is_active)
  }, [banners, remoteBanners])
  const [index, setIndex] = useState(0)
  const current = activeBanners[index] || activeBanners[0]

  useEffect(() => {
    fetch('/api/home-banners')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.banners) && data.banners.length > 0) {
          setRemoteBanners(data.banners)
          setIndex(0)
        }
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (activeBanners.length <= 1) return
    const timer = window.setInterval(() => {
      setIndex((value) => (value + 1) % activeBanners.length)
    }, 5200)
    return () => window.clearInterval(timer)
  }, [activeBanners.length])

  if (!current) return null

  const go = (next: number) => setIndex((next + activeBanners.length) % activeBanners.length)

  if (variant === 'hero') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
        <Link href={current.cta_href || '#'} className="block aspect-[16/9] w-full overflow-hidden bg-slate-100">
          <BannerPoster banner={current} imageFit="cover" />
        </Link>

        <div className="border-t border-slate-100 bg-white px-5 py-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{current.eyebrow}</div>
              <h2 className="mt-1 line-clamp-1 text-xl font-black tracking-normal text-slate-950">
                {current.title || current.subtitle}
              </h2>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                {current.description}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href={current.cta_href || '#'}
                className="inline-flex rounded-lg px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: themeColor[current.theme] || themeColor.blue }}
              >
                {current.cta_label || '查看详情'}
              </Link>
              {activeBanners.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => go(index - 1)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
                    aria-label="上一张广告"
                  >
                    <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => go(index + 1)}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300"
                    aria-label="下一张广告"
                  >
                    <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {activeBanners.length > 1 ? (
            <div className="mt-4 flex gap-1.5">
              {activeBanners.map((banner, bannerIndex) => (
                <button
                  key={banner.id}
                  type="button"
                  onClick={() => setIndex(bannerIndex)}
                  aria-label={`切换到第 ${bannerIndex + 1} 张广告`}
                  className={`h-1.5 rounded-full transition-all ${
                    bannerIndex === index ? 'w-8 bg-slate-900' : 'w-3 bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <section className="bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl">
            <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Featured Updates</span>
            <h2 className="mt-4 text-3xl font-black tracking-normal text-slate-950">精选动态与活动窗口</h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              活动海报、品牌动态和重点内容仍由后台维护，但不再承担首页第一印象。
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => go(index - 1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-800 transition hover:border-slate-300"
              aria-label="上一张"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <div className="min-w-[54px] text-center text-base font-black text-slate-800">
              {index + 1}/{activeBanners.length}
            </div>
            <button
              type="button"
              onClick={() => go(index + 1)}
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-800 transition hover:border-slate-300"
              aria-label="下一张"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </div>
        </div>

        <div className="grid gap-6 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[0.95fr_1.05fr] md:items-center md:p-6">
          <div className="aspect-[16/9] w-full overflow-hidden rounded-lg bg-slate-100">
            <BannerPoster banner={current} />
          </div>

          <div className="p-2 md:p-4">
            <div className="text-sm font-bold uppercase tracking-widest text-slate-400">{current.eyebrow}</div>
            <h3 className="mt-4 text-2xl font-black leading-tight tracking-normal text-slate-950 md:text-3xl">
              {current.title}
            </h3>
            <p className="mt-4 text-base leading-8 text-slate-600">
              {current.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={current.cta_href || '#'}
                className="inline-flex rounded-lg px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
                style={{ backgroundColor: themeColor[current.theme] || themeColor.blue }}
              >
                {current.cta_label || '了解更多'}
              </Link>
              {current.secondary_label && current.secondary_href && current.secondary_href !== '#' ? (
                <Link href={current.secondary_href} className="inline-flex rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
                  {current.secondary_label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
