-- v6.0 三级管理员架构 + 审计日志系统

-- 1. 管理员角色表（独立表，支持更精细的权限控制）
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super', 'level1', 'level2')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 从 profiles.role 迁移现有管理员角色
INSERT INTO admin_roles (user_id, role, created_at)
SELECT
  id,
  CASE
    WHEN role = 'admin_l1' THEN 'level1'
    WHEN role = 'admin_l2' THEN 'level2'
    ELSE 'level2'
  END,
  now()
FROM profiles
WHERE role IN ('admin_l1', 'admin_l2')
ON CONFLICT (user_id) DO NOTHING;

-- 2. 审计日志表
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                    -- create | update | delete | export | generate | award_points
  target_table TEXT,                       -- 操作的表名
  target_id TEXT,                          -- 操作的目标ID
  old_value JSONB,                         -- 修改前的值
  new_value JSONB,                         -- 修改后的值
  reason TEXT,                             -- 操作原因/备注
  ip_address INET,                         -- IP地址
  user_agent TEXT,                         -- User-Agent
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 导出限制追踪表（用于限制同一管理员1小时内最多导出3次）
CREATE TABLE IF NOT EXISTS admin_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL DEFAULT 'users',
  record_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. 积分发放日限额追踪表
CREATE TABLE IF NOT EXISTS admin_daily_points_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  award_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(admin_id, award_date)
);

-- 5. 辅助函数：获取当前用户的管理员角色
CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role, 'user')
  FROM public.admin_roles
  WHERE user_id = auth.uid();
$$;

-- 6. 辅助函数：检查是否为管理员（任意级别）
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid()
    AND role IN ('super', 'level1', 'level2')
  );
$$;

-- 7. 辅助函数：检查是否为 level1 或 super
CREATE OR REPLACE FUNCTION public.is_admin_level1_or_above()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid()
    AND role IN ('super', 'level1')
  );
$$;

-- 8. 辅助函数：检查是否为 super
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_roles
    WHERE user_id = auth.uid()
    AND role = 'super'
  );
$$;

-- 9. 触发器函数：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_admin_roles_updated_at ON admin_roles;
CREATE TRIGGER trg_admin_roles_updated_at
  BEFORE UPDATE ON admin_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 10. RLS 策略
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_daily_points_quota ENABLE ROW LEVEL SECURITY;

-- 管理员只能看到自己的角色信息（super 可以看到全部）
CREATE POLICY "admin_roles_select_own_or_super"
  ON admin_roles FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

-- 仅 super 可以创建/修改管理员角色
CREATE POLICY "admin_roles_manage_by_super"
  ON admin_roles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

-- 审计日志：管理员只能看到自己的操作记录（super 可以看到全部）
CREATE POLICY "audit_logs_select_own_or_super"
  ON admin_audit_logs FOR SELECT
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

-- 导出日志同理
CREATE POLICY "export_logs_select_own_or_super"
  ON admin_export_logs FOR SELECT
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

-- 日限额日志同理
CREATE POLICY "points_quota_select_own_or_super"
  ON admin_daily_points_quota FOR SELECT
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

-- 11. 索引优化
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON admin_roles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_export_logs_admin_id ON admin_export_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON admin_export_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_quota_admin_date ON admin_daily_points_quota(admin_id, award_date);
