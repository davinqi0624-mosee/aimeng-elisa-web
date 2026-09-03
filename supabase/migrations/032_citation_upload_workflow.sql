-- 文献上传审核流程增强：文件证据、AI候选信息、期刊封面与多货号展示

ALTER TABLE papers
  ALTER COLUMN authors DROP NOT NULL;

ALTER TABLE papers
  ALTER COLUMN journal DROP NOT NULL;

ALTER TABLE papers
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS detected_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS detected_brands JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS extraction_result JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence_text TEXT,
  ADD COLUMN IF NOT EXISTS journal_cover_url TEXT,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'customer_upload',
  ADD COLUMN IF NOT EXISTS discovery_status TEXT NOT NULL DEFAULT 'manual' CHECK (discovery_status IN ('manual', 'auto_found', 'confirmed', 'ignored'));

CREATE INDEX IF NOT EXISTS idx_papers_detected_products
  ON papers USING GIN (detected_products);

CREATE INDEX IF NOT EXISTS idx_papers_source_type
  ON papers(source_type);

ALTER TABLE point_transactions
  ADD COLUMN IF NOT EXISTS balance_after INTEGER,
  ADD COLUMN IF NOT EXISTS source_table TEXT;

ALTER TABLE point_transactions
  ALTER COLUMN source DROP NOT NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'point_transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%type%IN%earn%spend%refund%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE point_transactions DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

-- 单独的公开 citation 文件 bucket，便于后续备份和权限管理。
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES (
  'citation-files',
  'citation-files',
  true,
  false,
  20971520,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
