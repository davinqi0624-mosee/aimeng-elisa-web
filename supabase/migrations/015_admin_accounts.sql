-- 重构管理员认证系统：独立账号表 + 权限表

CREATE TABLE IF NOT EXISTS admin_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super', 'admin')),
  display_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES admin_accounts(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID REFERENCES admin_accounts(id) ON DELETE CASCADE,
  permission_code TEXT NOT NULL,
  is_allowed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admin_id, permission_code)
);

-- 初始化第一个超级管理员，默认密码 admin123（bcrypt hash）
INSERT INTO admin_accounts (username, password_hash, role, display_name)
VALUES ('admin-super1', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super', '系统管理员')
ON CONFLICT (username) DO NOTHING;

-- 索引
CREATE INDEX IF NOT EXISTS idx_admin_accounts_username ON admin_accounts(username);
CREATE INDEX IF NOT EXISTS idx_admin_accounts_role ON admin_accounts(role);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_admin_id ON admin_permissions(admin_id);

-- RLS（关闭，管理员表由应用层完全控制）
ALTER TABLE admin_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions DISABLE ROW LEVEL SECURITY;
