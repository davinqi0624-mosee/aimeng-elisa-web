-- v5.0 规范化 RBAC 权限体系（方案 B）
-- 角色: user | admin_l2 | admin_l1

-- 1. 创建用户档案表（如果不存在）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin_l2', 'admin_l1')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 自动为新注册用户创建 profile 的触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 确保触发器存在（先删除再重建以避免重复）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. 为已有用户创建 profile（如果还没有）
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

-- 3. 同步已有的 is_admin/is_staff 到 profiles.role（覆盖更新）
UPDATE profiles
SET role = sub.new_role
FROM (
  SELECT
    id,
    CASE
      WHEN (raw_user_meta_data->>'is_admin')::boolean = true THEN 'admin_l1'
      WHEN (raw_user_meta_data->>'is_staff')::boolean = true THEN 'admin_l2'
      ELSE 'user'
    END AS new_role
  FROM auth.users
) sub
WHERE profiles.id = sub.id
  AND profiles.role != sub.new_role;

-- 4. 启用 RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admin L1 can manage all profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin_l1'
    )
  );

-- 5. 辅助函数：获取当前用户角色
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(role, 'user') FROM public.profiles WHERE id = auth.uid();
$$;

-- 6. 辅助函数：是否为 L2 及以上管理员
CREATE OR REPLACE FUNCTION public.is_admin_l2_or_above()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin_l1', 'admin_l2')
  );
$$;

-- 7. 辅助函数：是否为 L1 管理员
CREATE OR REPLACE FUNCTION public.is_admin_l1()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin_l1'
  );
$$;

-- 8. 更新已有表的 RLS，允许管理员写入
-- papers: 管理员可以审核
CREATE POLICY "Admins can verify papers"
  ON papers FOR UPDATE
  USING (is_admin_l2_or_above());

-- shop_items: 管理员可以管理
CREATE POLICY "Admins can manage shop items"
  ON shop_items FOR ALL
  USING (is_admin_l2_or_above());

-- point_transactions: 管理员可以查看所有（用于审核）
CREATE POLICY "Admins can view all transactions"
  ON point_transactions FOR SELECT
  USING (is_admin_l2_or_above());

-- redeem_orders: 管理员可以查看和管理所有
CREATE POLICY "Admins can view all orders"
  ON redeem_orders FOR SELECT
  USING (is_admin_l2_or_above());

CREATE POLICY "Admins can update all orders"
  ON redeem_orders FOR UPDATE
  USING (is_admin_l2_or_above());
