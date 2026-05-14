-- ============================================================
-- 内页内容管理表
-- ============================================================

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

-- RLS 策略
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pages_select_public ON pages;
CREATE POLICY pages_select_public ON pages
  FOR SELECT TO PUBLIC USING (is_active = true);

DROP POLICY IF EXISTS pages_admin_all ON pages;
CREATE POLICY pages_admin_all ON pages
  FOR ALL TO PUBLIC USING (
    EXISTS (
      SELECT 1 FROM admin_accounts WHERE id = auth.uid()
    )
  );

-- 默认内容
INSERT INTO pages (slug, title, meta_title, meta_description, content, is_active) VALUES
('contact', '联系我们', '联系我们 - Animal Union 爱萌优宁', '联系 Animal Union 爱萌优宁，获取 ELISA 试剂盒产品咨询与技术支持。', '', true)
ON CONFLICT (slug) DO NOTHING;
