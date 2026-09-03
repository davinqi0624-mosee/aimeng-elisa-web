import { createClient } from '@/lib/supabase/server'

export type HomeBanner = {
  id: string
  title: string
  subtitle: string
  eyebrow: string
  description: string
  cta_label: string
  cta_href: string
  secondary_label: string
  secondary_href: string
  image_url: string
  theme: 'blue' | 'emerald' | 'amber' | 'rose'
  sort_order: number
  is_active: boolean
}

export const DEFAULT_HOME_BANNERS: HomeBanner[] = [
  {
    id: 'default-1-ai',
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
    id: 'default-2-promo',
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
    id: 'default-3-analysis',
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
    id: 'default-4-fbs',
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
    id: 'default-5-coa',
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
    id: 'default-6-points',
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
    id: 'default-7-community',
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
    id: 'default-8-daily',
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
    id: 'default-9-holiday',
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

export async function getHomeBanners(): Promise<HomeBanner[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('home_banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false })

    if (error) {
      console.warn('[home_banners] fallback to defaults:', error.message)
      return DEFAULT_HOME_BANNERS
    }

    return data?.length ? (data as HomeBanner[]) : DEFAULT_HOME_BANNERS
  } catch (err: any) {
    console.warn('[home_banners] unavailable, fallback to defaults:', err.message)
    return DEFAULT_HOME_BANNERS
  }
}
