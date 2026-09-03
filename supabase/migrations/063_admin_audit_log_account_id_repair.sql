-- 后台审计日志账号体系修复：
-- 早期 admin_audit_logs / admin_export_logs / admin_daily_points_quota 的 admin_id
-- 外键指向 profiles(id)。当前后台登录已切换为 admin_accounts(id)，导致后台操作
-- 审计写入被旧外键拦截。操作日志应保存操作者 UUID，不应因为新旧登录体系混用而丢失。

DO $$
DECLARE
  constraint_record RECORD;
BEGIN
  IF to_regclass('public.admin_audit_logs') IS NOT NULL THEN
    FOR constraint_record IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.admin_audit_logs'::regclass
        AND contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.admin_audit_logs DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
  END IF;

  IF to_regclass('public.admin_export_logs') IS NOT NULL THEN
    FOR constraint_record IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.admin_export_logs'::regclass
        AND contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.admin_export_logs DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
  END IF;

  IF to_regclass('public.admin_daily_points_quota') IS NOT NULL THEN
    FOR constraint_record IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.admin_daily_points_quota'::regclass
        AND contype = 'f'
    LOOP
      EXECUTE format('ALTER TABLE public.admin_daily_points_quota DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
  END IF;
END $$;

COMMENT ON COLUMN admin_audit_logs.admin_id IS '后台操作人 UUID。当前主要来自 admin_accounts.id；历史记录可能来自 profiles.id，因此不绑定单一外键。';

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id
  ON admin_audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON admin_audit_logs(action);

NOTIFY pgrst, 'reload schema';
