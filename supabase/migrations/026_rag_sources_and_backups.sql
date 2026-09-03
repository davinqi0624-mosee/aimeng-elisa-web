-- ============================================================
-- RAG sources, ingestion runs, vector search, and backup records
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS source_id UUID,
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS trust_level TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_embedded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS token_count INTEGER,
  ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'draft';

CREATE TABLE IF NOT EXISTS rag_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_path TEXT,
  source_url TEXT,
  file_name TEXT,
  file_mime TEXT,
  file_size BIGINT,
  checksum TEXT,
  trust_level TEXT DEFAULT 'manual',
  review_status TEXT DEFAULT 'raw',
  owner_note TEXT,
  metadata JSONB DEFAULT '{}',
  collected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE rag_sources IS 'RAG 原始资料来源：产品说明书、SOP、文献、实验案例、客服对话等';

CREATE TABLE IF NOT EXISTS rag_ingestion_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES rag_sources(id) ON DELETE SET NULL,
  run_type TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  documents_created INTEGER DEFAULT 0,
  chunks_created INTEGER DEFAULT 0,
  chunks_embedded INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ
);

COMMENT ON TABLE rag_ingestion_runs IS 'RAG 入库任务记录：清洗、切片、向量化、审核状态';

CREATE TABLE IF NOT EXISTS system_backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  storage_path TEXT,
  database_dump_path TEXT,
  assets_archive_path TEXT,
  checksum TEXT,
  size_bytes BIGINT,
  details JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE system_backup_runs IS '系统备份记录：数据库、资料文件、知识库和文件资产';

CREATE INDEX IF NOT EXISTS idx_rag_sources_type_status
  ON rag_sources(source_type, review_status);

CREATE INDEX IF NOT EXISTS idx_rag_sources_checksum
  ON rag_sources(checksum);

CREATE INDEX IF NOT EXISTS idx_rag_ingestion_runs_status
  ON rag_ingestion_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_backup_runs_status
  ON system_backup_runs(status, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_review_status
  ON knowledge_base(review_status);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_source_hash
  ON knowledge_base(source_hash);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_review_status
  ON knowledge_chunks(review_status);

CREATE OR REPLACE FUNCTION match_knowledge(
  query_embedding vector(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 5
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  tags TEXT[],
  similarity FLOAT
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kb.id,
    kb.title,
    kc.content,
    kb.category,
    kb.tags,
    1 - (kc.embedding <=> query_embedding)::FLOAT AS similarity
  FROM knowledge_chunks kc
  JOIN knowledge_base kb ON kb.id = kc.knowledge_id
  WHERE
    kb.is_published = true
    AND coalesce(kb.review_status, 'reviewed') IN ('reviewed', 'published')
    AND coalesce(kc.review_status, 'reviewed') IN ('reviewed', 'published')
    AND kc.embedding IS NOT NULL
    AND 1 - (kc.embedding <=> query_embedding)::FLOAT > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;

ALTER TABLE rag_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rag_sources admin all" ON rag_sources;
CREATE POLICY "rag_sources admin all" ON rag_sources
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "rag_ingestion_runs admin all" ON rag_ingestion_runs;
CREATE POLICY "rag_ingestion_runs admin all" ON rag_ingestion_runs
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "system_backup_runs super admin all" ON system_backup_runs;
CREATE POLICY "system_backup_runs super admin all" ON system_backup_runs
  FOR ALL USING (EXISTS (SELECT 1 FROM admin_roles WHERE user_id = auth.uid() AND role = 'super'));
