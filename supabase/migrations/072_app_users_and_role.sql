-- 072: 自建用户认证（auth-decoupling 项目，纯增量，可先行应用）
-- app_users 取代 auth.users 作为身份源；user_auth_tokens 存邮箱验证/密码重置令牌（仅存哈希）。
-- 两表 RLS 开启且无任何策略：anon/authenticated/app_user 一律拒绝，仅 service_role 与直连事务可访问。

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  full_name TEXT,
  organization TEXT,
  phone TEXT,
  email_verified_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_password BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_auth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('email_verify', 'password_reset')),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_auth_tokens_user ON user_auth_tokens(user_id, purpose);

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_auth_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON app_users FROM anon, authenticated;
REVOKE ALL ON user_auth_tokens FROM anon, authenticated;

-- app_user：应用直连事务使用的受限角色（RLS 生效、无 BYPASSRLS）。
-- 身份注入机制：事务内 SET LOCAL ROLE app_user + set_config('request.jwt.claims', '{"sub":...}', true)，
-- 现有 auth.uid() 策略原样生效（与 PostgREST 同机制）。
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN NOBYPASSRLS;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT app_user TO postgres;

-- app_uid()：读取 request.jwt.claims GUC 的 sub（与 Supabase auth.uid() 同义，但位于 public schema，
-- app_user 可执行——auth schema 归 supabase_admin，无法给自定义角色授权）。
-- PostgREST 请求同样设置该 GUC，因此新旧两条路径读到同一身份，过渡零中断。
CREATE OR REPLACE FUNCTION public.app_uid()
RETURNS UUID
LANGUAGE sql STABLE
SET search_path = pg_catalog
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
$$;

-- 只读面：站点公开数据（敏感表随后单独回收，RLS 无策略的表即使误授权也会被拒绝）
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_user;
REVOKE ALL ON app_users, user_auth_tokens FROM app_user;
REVOKE ALL ON admin_accounts, admin_permissions FROM app_user;
REVOKE ALL ON admin_login_security, registration_security_usage, ai_request_usage FROM app_user;
-- rag_sources / rag_ingestion_runs / system_backup_runs 仅存在于迁移文件，活库未建（026 未应用），如后续创建请同样回收 app_user
REVOKE SELECT, UPDATE, DELETE, INSERT ON site_settings FROM app_user;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO app_user;

-- 用户自有数据 DML（与 RLS own 策略一一对应，策略在 073 收紧时同步扩展角色面）
GRANT SELECT, INSERT, UPDATE, DELETE ON auto_datasheets, experiments, ai_conversations, ai_messages TO app_user;
GRANT SELECT, INSERT ON papers, redeem_orders, analysis_reports TO app_user;
GRANT SELECT, UPDATE ON profiles TO app_user;
GRANT SELECT ON point_transactions, point_reward_claims, purchase_point_claims, purchase_point_claim_photos, shop_items TO app_user;

-- 存量回填：同 UUID 迁入 app_users（GoTrue 不允许导出密码哈希，老用户须重置密码）
INSERT INTO app_users (id, email, full_name, organization, phone, email_verified_at, must_change_password, created_at)
SELECT
  u.id,
  lower(u.email),
  u.raw_user_meta_data ->> 'full_name',
  u.raw_user_meta_data ->> 'organization',
  u.raw_user_meta_data ->> 'phone',
  u.email_confirmed_at,
  true,
  u.created_at
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- profiles 缺行补建（15 用户 / 14 profiles，差 1）
INSERT INTO profiles (id, full_name, role)
SELECT
  a.id,
  COALESCE(NULLIF(a.full_name, ''), split_part(a.email, '@', 1)),
  'user'
FROM app_users a
LEFT JOIN profiles p ON p.id = a.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE app_users IS '自建用户身份表（取代 Supabase auth.users），密码 bcrypt 哈希；RLS 拒绝一切非 service_role 访问。';
COMMENT ON TABLE user_auth_tokens IS '邮箱验证/密码重置令牌（仅存 SHA-256 哈希），过期或已用即失效。';
