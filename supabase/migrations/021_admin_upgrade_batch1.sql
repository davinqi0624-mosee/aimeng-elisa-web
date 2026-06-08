-- ============================================================
-- 后台管理系统升级 - Batch 1: 数据库表扩展
-- ============================================================

-- 1. products 表扩展：增加图片和PDF字段
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_image TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS standard_curve_image TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS validation_image TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS additional_image TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS datasheet_pdf TEXT;

-- 2. agents 表扩展：确保联系信息字段存在
ALTER TABLE agents ADD COLUMN IF NOT EXISTS wechat_qr TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS address TEXT;

-- 3. papers 表（如果尚未创建则创建）
CREATE TABLE IF NOT EXISTS papers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  authors TEXT,
  journal TEXT,
  doi TEXT,
  link TEXT,
  status TEXT DEFAULT 'pending',
  upload_status TEXT DEFAULT 'pending',
  publication_date DATE,
  product_cat_no TEXT,
  impact_factor DECIMAL(5,2),
  citation_type TEXT DEFAULT 'user_submitted',
  is_displayed BOOLEAN DEFAULT false,
  verified_by UUID REFERENCES profiles(id),
  verified_at TIMESTAMPTZ,
  points_awarded INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- papers 索引
CREATE INDEX IF NOT EXISTS idx_papers_product_cat_no ON papers(product_cat_no) WHERE upload_status = 'verified';
CREATE INDEX IF NOT EXISTS idx_papers_is_displayed ON papers(is_displayed);
CREATE INDEX IF NOT EXISTS idx_papers_upload_status ON papers(upload_status);

-- papers RLS
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS papers_select_public ON papers;
CREATE POLICY papers_select_public ON papers FOR SELECT TO PUBLIC USING (upload_status = 'verified' AND is_displayed = true);

-- 4. point_transactions 表（如果尚未创建则创建）
CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  type TEXT NOT NULL,
  source TEXT,
  source_id UUID,
  description TEXT,
  admin_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- point_transactions 索引
CREATE INDEX IF NOT EXISTS idx_pt_user_id ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_pt_created_at ON point_transactions(created_at);

-- point_transactions RLS
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pt_select_own ON point_transactions;
CREATE POLICY pt_select_own ON point_transactions FOR SELECT USING (auth.uid() = user_id);

-- 5. pages 表（如果尚未创建则创建）
CREATE TABLE IF NOT EXISTS pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  meta_title TEXT,
  meta_description TEXT,
  content TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- pages RLS
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pages_select_public ON pages;
CREATE POLICY pages_select_public ON pages FOR SELECT TO PUBLIC USING (is_active = true);

-- 6. pages 预设数据（5条）
INSERT INTO pages (slug, title, meta_title, meta_description, content, is_active) VALUES
('contact', '联系我们', '联系我们 - AIMENG UNING 爱萌优宁', '联系 AIMENG UNING 爱萌优宁，获取 ELISA 试剂盒产品咨询与技术支持。', '', true),
('about', '关于我们', '关于我们 - AIMENG UNING 爱萌优宁', '了解 AIMENG UNING 爱萌优宁的公司背景、研发团队与使命愿景。', '', true),
('privacy', '隐私政策', '隐私政策 - AIMENG UNING 爱萌优宁', 'AIMENG UNING 爱萌优宁隐私政策，说明我们如何收集、使用和保护您的个人信息。', '', true),
('terms', '服务条款', '服务条款 - AIMENG UNING 爱萌优宁', 'AIMENG UNING 爱萌优宁服务条款，使用本网站前请仔细阅读。', '', true),
('faq', '常见问题', '常见问题 - AIMENG UNING 爱萌优宁', 'ELISA 试剂盒常见问题解答，帮助您快速找到答案。', '', true)
ON CONFLICT (slug) DO NOTHING;
