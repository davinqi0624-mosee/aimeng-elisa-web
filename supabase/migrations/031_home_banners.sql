CREATE TABLE IF NOT EXISTS home_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  eyebrow TEXT NOT NULL DEFAULT 'PROMOTION',
  description TEXT NOT NULL DEFAULT '',
  cta_label TEXT NOT NULL DEFAULT '查看详情',
  cta_href TEXT NOT NULL DEFAULT '/',
  secondary_label TEXT NOT NULL DEFAULT '',
  secondary_href TEXT NOT NULL DEFAULT '#',
  image_url TEXT NOT NULL DEFAULT '',
  theme TEXT NOT NULL DEFAULT 'blue' CHECK (theme IN ('blue', 'emerald', 'amber', 'rose')),
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_banners_active_sort
  ON home_banners(is_active, sort_order);

ALTER TABLE home_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS home_banners_select_active ON home_banners;
CREATE POLICY home_banners_select_active
  ON home_banners
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

INSERT INTO home_banners (
  id, title, subtitle, eyebrow, description,
  cta_label, cta_href, secondary_label, secondary_href,
  image_url, theme, sort_order, is_active
) VALUES
  (
    '00000000-0000-0000-0000-000000031001',
    '更少搜索，更快速进展',
    '爱萌AI助手即刻开启',
    'AI ASSISTANT',
    '从实验方案、产品推荐到数据分析，爱萌优宁AI助手帮助科研人员更快完成每一个关键步骤。',
    '开始体验',
    '/chat?mode=protocol',
    '',
    '#',
    '',
    'blue',
    1,
    true
  ),
  (
    '00000000-0000-0000-0000-000000031002',
    '重点产品限时活动',
    'ELISA 试剂盒精选推荐',
    'PROMOTION',
    '适合新品发布、节日活动和重点指标推广。后台上传活动海报后，会在右侧大图区域轮播展示。',
    '了解更多',
    '/products/elisa',
    '',
    '#',
    '',
    'amber',
    2,
    true
  ),
  (
    '00000000-0000-0000-0000-000000031003',
    'ELISA Calc 功能升级',
    '从OD值到报告一站完成',
    'DATA ANALYSIS',
    '导入实验数据后完成标准曲线绘制、4PL拟合、样本浓度计算，并生成规范实验报告。',
    '进入数据分析',
    '/lab/analysis',
    '',
    '#',
    '',
    'emerald',
    3,
    true
  ),
  (
    '00000000-0000-0000-0000-000000031004',
    '胎牛血清产品展示',
    '高品质细胞培养支持',
    'FBS SHOWCASE',
    '用于展示标准胎牛血清、特殊工艺血清及细胞测试数据，客户可快速进入产品内页了解详情。',
    '查看胎牛血清',
    '/products/fbs',
    '',
    '#',
    '',
    'rose',
    4,
    true
  ),
  (
    '00000000-0000-0000-0000-000000031005',
    'COA 查询系统',
    '批次文件快速获取',
    'COA LOOKUP',
    '血清产品可按货号和批号查询 COA 文件，便于客户保存质控资料和追溯生产批次。',
    '进入COA查询',
    '/products/coa',
    '',
    '#',
    '',
    'blue',
    5,
    true
  ),
  (
    '00000000-0000-0000-0000-000000031006',
    '文献引用积分活动',
    '论文成果兑换奖励',
    'POINTS CAMPAIGN',
    '客户提交使用爱萌产品发表的文献，审核通过后获得积分，可在积分商城兑换科研礼品。',
    '提交文献',
    '/user/citations/submit',
    '',
    '#',
    '',
    'amber',
    6,
    true
  ),
  (
    '00000000-0000-0000-0000-000000031007',
    '科研社区上线',
    '讨论实验问题与经验',
    'COMMUNITY',
    '客户可以围绕实验设计、操作问题和数据分析进行交流，沉淀常见问题与解决方案。',
    '进入科研社区',
    '/community',
    '',
    '#',
    '',
    'emerald',
    7,
    true
  ),
  (
    '00000000-0000-0000-0000-000000031008',
    '每日知识更新',
    '每天一点ELISA经验',
    'DAILY KNOWLEDGE',
    '围绕ELISA原理、样本处理、数据分析和常见问题，持续更新可读、可用的实验知识。',
    '查看每日知识',
    '/knowledge',
    '',
    '#',
    '',
    'blue',
    8,
    true
  ),
  (
    '00000000-0000-0000-0000-000000031009',
    '节日祝福与活动公告',
    '品牌动态集中展示',
    'BRAND NEWS',
    '节日海报、展会通知、促销活动和公司公告，都可以在这里以大图轮播形式展示。',
    '联系我们',
    '/contact',
    '',
    '#',
    '',
    'rose',
    9,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  subtitle = EXCLUDED.subtitle,
  eyebrow = EXCLUDED.eyebrow,
  description = EXCLUDED.description,
  cta_label = EXCLUDED.cta_label,
  cta_href = EXCLUDED.cta_href,
  secondary_label = EXCLUDED.secondary_label,
  secondary_href = EXCLUDED.secondary_href,
  image_url = EXCLUDED.image_url,
  theme = EXCLUDED.theme,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

NOTIFY pgrst, 'reload schema';
