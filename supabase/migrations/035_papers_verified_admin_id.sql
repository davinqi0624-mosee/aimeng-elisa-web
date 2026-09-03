-- 文献审核人兼容后台管理员账号体系。
-- 旧字段 verified_by 指向 profiles(id)，而当前后台登录使用 admin_accounts。

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS verified_admin_id UUID REFERENCES admin_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_papers_verified_admin_id
  ON papers(verified_admin_id)
  WHERE verified_admin_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
