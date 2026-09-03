ALTER TABLE auto_datasheets
  ADD COLUMN IF NOT EXISTS admin_id UUID REFERENCES admin_accounts(id) ON DELETE SET NULL;

ALTER TABLE auto_datasheets
  ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auto_datasheets_admin_id
  ON auto_datasheets(admin_id);
