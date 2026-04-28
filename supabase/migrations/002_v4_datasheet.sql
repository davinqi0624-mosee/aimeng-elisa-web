-- v4.0 智能说明书引擎数据库迁移

-- 1. 抗体目录表（用于说明书生成时选择抗体）
CREATE TABLE IF NOT EXISTS antibody_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier TEXT NOT NULL,
  catalog_number TEXT NOT NULL,
  target TEXT NOT NULL,
  species TEXT NOT NULL,
  clone_number TEXT,
  host TEXT NOT NULL,
  reactivity TEXT,
  applications TEXT,
  concentration TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE antibody_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "antibody_select_all" ON antibody_catalog FOR SELECT USING (true);
CREATE POLICY "antibody_insert_admin" ON antibody_catalog FOR INSERT WITH CHECK (true);
CREATE POLICY "antibody_update_admin" ON antibody_catalog FOR UPDATE USING (true);

-- 2. 说明书模板表（不同实验方法的模板章节）
CREATE TABLE IF NOT EXISTS datasheet_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  method TEXT NOT NULL, -- sandwich, competitive, chemiluminescence
  description TEXT,
  sections JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE datasheet_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_select_all" ON datasheet_templates FOR SELECT USING (true);
CREATE POLICY "template_insert_admin" ON datasheet_templates FOR INSERT WITH CHECK (true);

-- 3. 用户生成的说明书表
CREATE TABLE IF NOT EXISTS auto_datasheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target TEXT NOT NULL,
  species TEXT NOT NULL,
  method TEXT NOT NULL,
  template_id UUID REFERENCES datasheet_templates(id),
  antibody_id UUID REFERENCES antibody_catalog(id),
  content JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE auto_datasheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "datasheet_select_own" ON auto_datasheets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "datasheet_insert_own" ON auto_datasheets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "datasheet_update_own" ON auto_datasheets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "datasheet_delete_own" ON auto_datasheets FOR DELETE USING (auth.uid() = user_id);

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_antibody_target ON antibody_catalog(target);
CREATE INDEX IF NOT EXISTS idx_antibody_supplier ON antibody_catalog(supplier);
CREATE INDEX IF NOT EXISTS idx_antibody_status ON antibody_catalog(status);
CREATE INDEX IF NOT EXISTS idx_datasheet_user_id ON auto_datasheets(user_id);
CREATE INDEX IF NOT EXISTS idx_datasheet_status ON auto_datasheets(status);
