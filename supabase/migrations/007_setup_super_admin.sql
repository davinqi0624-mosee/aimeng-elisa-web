-- ============================================================
-- 小白专用：一键初始化管理员体系 + 自动把你设为超级管理员
-- 操作：全选复制 → 粘贴到 Supabase SQL Editor → 点击 Run
-- ============================================================

-- 第一步：确保 profiles 表存在（如果之前没建过）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 第二步：为所有已有用户自动创建 profiles（如果没的话）
INSERT INTO profiles (id, full_name, role)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  CASE
    WHEN (au.raw_user_meta_data->>'is_admin')::boolean = true THEN 'admin_l1'
    WHEN (au.raw_user_meta_data->>'is_staff')::boolean = true THEN 'admin_l2'
    ELSE 'user'
  END
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 第三步：创建管理员角色表
CREATE TABLE IF NOT EXISTS admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super', 'level1', 'level2')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 第四步：创建审计日志表
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 第五步：创建导出限制追踪表
CREATE TABLE IF NOT EXISTS admin_export_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  export_type TEXT NOT NULL DEFAULT 'users',
  record_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 第六步：创建积分发放日限额追踪表
CREATE TABLE IF NOT EXISTS admin_daily_points_quota (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL DEFAULT 0,
  award_date DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE(admin_id, award_date)
);

-- 第七步：辅助函数
CREATE OR REPLACE FUNCTION public.current_admin_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role, 'user')
  FROM public.admin_roles
  WHERE user_id = auth.uid();
$$;

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

-- 第八步：RLS 策略
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_daily_points_quota ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "admin_roles_select_own_or_super"
  ON admin_roles FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

CREATE POLICY IF NOT EXISTS "admin_roles_manage_by_super"
  ON admin_roles FOR ALL
  USING (
    EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

CREATE POLICY IF NOT EXISTS "audit_logs_select_own_or_super"
  ON admin_audit_logs FOR SELECT
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

CREATE POLICY IF NOT EXISTS "export_logs_select_own_or_super"
  ON admin_export_logs FOR SELECT
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

CREATE POLICY IF NOT EXISTS "points_quota_select_own_or_super"
  ON admin_daily_points_quota FOR SELECT
  USING (
    admin_id = auth.uid()
    OR EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super')
  );

-- 第九步：索引
CREATE INDEX IF NOT EXISTS idx_admin_roles_user_id ON admin_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON admin_roles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_export_logs_admin_id ON admin_export_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON admin_export_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_quota_admin_date ON admin_daily_points_quota(admin_id, award_date);

-- ============================================================
-- 第十步：自动把你设为超级管理员
-- 规则：找到最近登录过的用户，设为 super
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- 找到最近登录的用户（应该就是你自己）
  SELECT id INTO v_user_id
  FROM auth.users
  ORDER BY last_sign_in_at DESC NULLS LAST
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- 确保该用户有 profiles 记录
    INSERT INTO profiles (id, full_name, role)
    VALUES (
      v_user_id,
      COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = v_user_id), 'Admin'),
      'user'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 设为 super
    INSERT INTO admin_roles (user_id, role, created_at)
    VALUES (v_user_id, 'super', now())
    ON CONFLICT (user_id) DO UPDATE SET role = 'super';

    RAISE NOTICE '已成功将用户 % 设为超级管理员 (super)', v_user_id;
  ELSE
    RAISE NOTICE '未找到用户，请手动执行插入语句';
  END IF;
END $$;
