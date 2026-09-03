CREATE TABLE IF NOT EXISTS home_media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL CHECK (category IN ('elisa', 'cell_culture')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '小红书',
  external_url TEXT NOT NULL,
  cover_image_url TEXT NOT NULL DEFAULT '',
  published_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 1,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_home_media_items_public
  ON home_media_items(category, is_active, is_featured DESC, sort_order, published_at DESC);

ALTER TABLE home_media_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS home_media_items_select_active ON home_media_items;
CREATE POLICY home_media_items_select_active
  ON home_media_items
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

INSERT INTO home_media_items (
  id, category, title, summary, platform, external_url, cover_image_url,
  published_at, sort_order, is_featured, is_active
) VALUES
  (
    '00000000-0000-0000-0000-000000053001',
    'elisa',
    '标准曲线与 4PL 拟合',
    'ELISA 数据分析与标准曲线计算内容入口。',
    '小红书',
    '/videos',
    '/images/elisa/elisa_sandwich_pencil.jpg',
    NOW(),
    1,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000053002',
    'elisa',
    '样本处理与稀释建议',
    '常见样本处理、稀释倍数和实验注意事项。',
    '小红书',
    '/videos',
    '',
    NOW(),
    2,
    false,
    true
  ),
  (
    '00000000-0000-0000-0000-000000053003',
    'elisa',
    '说明书参数解读',
    '帮助客户理解说明书中的检测范围、灵敏度和样本要求。',
    '小红书',
    '/videos',
    '',
    NOW(),
    3,
    false,
    true
  ),
  (
    '00000000-0000-0000-0000-000000053004',
    'cell_culture',
    '细胞培养状态观察',
    '细胞培养、血清选型和日常实验观察内容入口。',
    '小红书',
    '/videos',
    '/images/elisa/elisa_sandwich_lego.jpg',
    NOW(),
    1,
    true,
    true
  ),
  (
    '00000000-0000-0000-0000-000000053005',
    'cell_culture',
    '胎牛血清批次 COA',
    '血清批次、COA 和应用场景相关内容。',
    '小红书',
    '/videos',
    '',
    NOW(),
    2,
    false,
    true
  ),
  (
    '00000000-0000-0000-0000-000000053006',
    'cell_culture',
    '污染与传代提醒',
    '细胞污染识别、传代节奏和培养状态维护。',
    '小红书',
    '/videos',
    '',
    NOW(),
    3,
    false,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  platform = EXCLUDED.platform,
  external_url = EXCLUDED.external_url,
  cover_image_url = EXCLUDED.cover_image_url,
  published_at = EXCLUDED.published_at,
  sort_order = EXCLUDED.sort_order,
  is_featured = EXCLUDED.is_featured,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMENT ON TABLE home_media_items IS '首页自媒体内容窗口：用于维护 ELISA、细胞培养等分类的小红书/视频内容链接。';

NOTIFY pgrst, 'reload schema';
