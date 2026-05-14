-- ============================================================
-- 代理商管理表
-- ============================================================

CREATE TABLE IF NOT EXISTS agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  province TEXT NOT NULL,
  province_code TEXT,
  city TEXT,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  phone TEXT,
  email TEXT,
  wechat_qr_code TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_agents_province ON agents(province);
CREATE INDEX IF NOT EXISTS idx_agents_is_active ON agents(is_active);

-- RLS 策略（允许公开读取，管理员可写）
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agents_select_public ON agents;
CREATE POLICY agents_select_public ON agents
  FOR SELECT TO PUBLIC USING (true);

DROP POLICY IF EXISTS agents_admin_all ON agents;
CREATE POLICY agents_admin_all ON agents
  FOR ALL TO PUBLIC USING (
    EXISTS (
      SELECT 1 FROM admin_accounts WHERE id = auth.uid()
    )
  );

-- 示例数据
INSERT INTO agents (province, province_code, city, company_name, contact_name, phone, email, address, is_active, sort_order) VALUES
('上海', 'shanghai', '浦东新区', '上海瑞博生物科技有限公司', '张经理', '138-0013-8000', 'zhang@ruibo-bio.com', '上海市浦东新区张江高科技园区科苑路88号', true, 1),
('北京', 'beijing', '海淀区', '北京恒信生物技术公司', '李经理', '139-0013-9000', 'li@hengxin-bio.com', '北京市海淀区中关村大街1号', true, 2),
('广东', 'guangdong', '广州市', '广州康宁生物科技有限公司', '王经理', '137-0013-7000', 'wang@kangning-bio.com', '广州市天河区珠江新城华夏路10号', true, 3),
('江苏', 'jiangsu', '南京市', '南京优宁生物技术有限公司', '陈经理', '136-0013-6000', 'chen@youning-bio.com', '南京市玄武区珠江路600号', true, 4)
ON CONFLICT DO NOTHING;
